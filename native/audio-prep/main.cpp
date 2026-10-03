// audio-prep: decode any audio file and write the 44.1 kHz stereo float WAV
// that the separator expects. Prints "PROGRESS n" lines to stdout.

#include "decode.h"
#include "utf8_win.h"

#ifdef _WIN32
#include <shellapi.h>
#endif

#define MINIAUDIO_IMPLEMENTATION
#include "vendor/miniaudio.h"

#include "vendor/r8brain-free-src/CDSPResampler.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

static const uint32_t TARGET_RATE = 44100;

static int lastProgress = -1;
static void progress(int pct) {
    if (pct == lastProgress) return;
    lastProgress = pct;
    printf("PROGRESS %d\n", pct);
    fflush(stdout);
}

static std::vector<std::string> getArgs(int argc, char* argv[]) {
#ifdef _WIN32
    int wargc = 0;
    wchar_t** wargv = CommandLineToArgvW(GetCommandLineW(), &wargc);
    std::vector<std::string> args;
    for (int i = 0; i < wargc; i++) args.push_back(narrow(wargv[i]));
    LocalFree(wargv);
    return args;
#else
    return std::vector<std::string>(argv, argv + argc);
#endif
}

static FILE* openFile(const std::string& path, const char* mode) {
#ifdef _WIN32
    return _wfopen(widen(path).c_str(), widen(mode).c_str());
#else
    return fopen(path.c_str(), mode);
#endif
}

// Fast path for WAV, MP3 and FLAC.
static bool decodeWithMiniaudio(const std::string& path, DecodedAudio& out, std::string& error) {
    ma_decoder_config config = ma_decoder_config_init(ma_format_f32, 0, 0);
    ma_decoder decoder;
#ifdef _WIN32
    ma_result result = ma_decoder_init_file_w(widen(path).c_str(), &config, &decoder);
#else
    ma_result result = ma_decoder_init_file(path.c_str(), &config, &decoder);
#endif
    if (result != MA_SUCCESS) {
        error = "miniaudio error " + std::to_string(result);
        return false;
    }
    out.sampleRate = decoder.outputSampleRate;
    out.channels = decoder.outputChannels;

    ma_uint64 totalFrames = 0;
    ma_decoder_get_length_in_pcm_frames(&decoder, &totalFrames);

    const ma_uint64 chunkFrames = 65536;
    std::vector<float> chunk(chunkFrames * out.channels);
    ma_uint64 framesRead = 0, totalRead = 0;
    while (ma_decoder_read_pcm_frames(&decoder, chunk.data(), chunkFrames, &framesRead), framesRead > 0) {
        out.samples.insert(out.samples.end(), chunk.begin(), chunk.begin() + framesRead * out.channels);
        totalRead += framesRead;
        if (totalFrames > 0) progress((int)std::fmin(10.0, 10.0 * totalRead / totalFrames));
    }
    ma_decoder_uninit(&decoder);

    if (out.samples.empty()) {
        error = "no audio frames";
        return false;
    }
    return true;
}

// Mono is duplicated. Surround (WAVE order: L R C LFE Ls Rs ...) gets the standard
// ITU downmix, scaled back down only if it would clip.
static std::vector<float> toStereo(DecodedAudio& audio) {
    const uint32_t ch = audio.channels;
    if (ch == 2) return std::move(audio.samples);

    const size_t frames = audio.samples.size() / ch;
    std::vector<float> stereo(frames * 2);
    const float k = 0.7071f;
    float peak = 0.0f;
    for (size_t i = 0; i < frames; i++) {
        const float* f = &audio.samples[i * ch];
        float l = f[0], r = ch == 1 ? f[0] : f[1];
        if (ch >= 3) { l += k * f[2]; r += k * f[2]; }
        if (ch >= 6) { l += k * f[4]; r += k * f[5]; }
        stereo[i * 2] = l;
        stereo[i * 2 + 1] = r;
        peak = std::max(peak, std::max(std::fabs(l), std::fabs(r)));
    }
    if (ch > 2 && peak > 1.0f) {
        for (float& s : stereo) s /= peak;
    }
    return stereo;
}

static std::vector<float> resampleStereo(const std::vector<float>& input, uint32_t fromRate) {
    const int inFrames = (int)(input.size() / 2);
    const int outFrames = (int)std::ceil((double)inFrames * TARGET_RATE / fromRate);
    std::vector<float> output((size_t)outFrames * 2);

    for (int ch = 0; ch < 2; ch++) {
        std::vector<double> in(inFrames), out(outFrames);
        for (int i = 0; i < inFrames; i++) in[i] = input[(size_t)i * 2 + ch];
        r8b::CDSPResampler24 resampler(fromRate, TARGET_RATE, inFrames);
        resampler.oneshot(in.data(), inFrames, out.data(), outFrames);
        for (int i = 0; i < outFrames; i++) output[(size_t)i * 2 + ch] = (float)out[i];
        progress(ch == 0 ? 50 : 75);
    }
    return output;
}

static bool writeWav(const std::string& path, const std::vector<float>& samples) {
    FILE* f = openFile(path, "wb");
    if (!f) return false;

    const uint16_t channels = 2, bits = 32, format = 3; // IEEE float
    const uint32_t rate = TARGET_RATE;
    const uint16_t blockAlign = channels * bits / 8;
    const uint32_t byteRate = rate * blockAlign;
    const uint32_t dataBytes = (uint32_t)(samples.size() * sizeof(float));
    const uint32_t riffSize = 36 + dataBytes, fmtSize = 16;

    fwrite("RIFF", 1, 4, f); fwrite(&riffSize, 4, 1, f); fwrite("WAVE", 1, 4, f);
    fwrite("fmt ", 1, 4, f); fwrite(&fmtSize, 4, 1, f); fwrite(&format, 2, 1, f);
    fwrite(&channels, 2, 1, f); fwrite(&rate, 4, 1, f); fwrite(&byteRate, 4, 1, f);
    fwrite(&blockAlign, 2, 1, f); fwrite(&bits, 2, 1, f);
    fwrite("data", 1, 4, f); fwrite(&dataBytes, 4, 1, f);

    const size_t chunk = 1 << 18;
    for (size_t written = 0; written < samples.size(); written += chunk) {
        size_t n = std::min(chunk, samples.size() - written);
        if (fwrite(samples.data() + written, sizeof(float), n, f) != n) {
            fclose(f);
            return false;
        }
        progress(80 + (int)(19.0 * (written + n) / samples.size()));
    }
    return fclose(f) == 0;
}

int main(int argc, char* argv[]) {
    std::vector<std::string> args = getArgs(argc, argv);
    std::string inputPath, outputPath;
    for (size_t i = 1; i + 1 < args.size(); i++) {
        if (args[i] == "--input") inputPath = args[++i];
        else if (args[i] == "--output") outputPath = args[++i];
    }
    if (inputPath.empty() || outputPath.empty()) {
        fprintf(stderr, "Usage: audio-prep --input <file> --output <file>\n");
        return 1;
    }

    FILE* probe = openFile(inputPath, "rb");
    if (!probe) {
        fprintf(stderr, "Error: cannot open '%s'\n", inputPath.c_str());
        return 1;
    }
    fclose(probe);

    progress(0);

    DecodedAudio audio;
    std::string fastError, systemError;
    if (!decodeWithMiniaudio(inputPath, audio, fastError)) {
        audio = DecodedAudio();
        if (!decodeWithSystem(inputPath, audio, systemError)) {
            fprintf(stderr, "Error: could not read '%s' (%s; %s)\n",
                    inputPath.c_str(), fastError.c_str(), systemError.c_str());
            return 1;
        }
    }
    progress(15);

    const uint32_t inputRate = audio.sampleRate;
    const double seconds = (double)audio.samples.size() / audio.channels / inputRate;
    fprintf(stderr, "Input: %u Hz, %u ch, %.2f sec\n", inputRate, audio.channels, seconds);

    std::vector<float> stereo = toStereo(audio);
    progress(20);
    if (inputRate != TARGET_RATE) stereo = resampleStereo(stereo, inputRate);
    progress(80);

    if (!writeWav(outputPath, stereo)) {
        fprintf(stderr, "Error: could not write '%s'\n", outputPath.c_str());
        return 1;
    }
    progress(100);
    return 0;
}
