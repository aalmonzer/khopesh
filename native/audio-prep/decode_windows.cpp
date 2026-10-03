#include "decode.h"
#include "utf8_win.h"

#include <mfapi.h>
#include <mferror.h>
#include <mfidl.h>
#include <mfreadwrite.h>

#include <cstring>

namespace {

template <typename T>
struct Com {
    T* p = nullptr;
    ~Com() { if (p) p->Release(); }
    T** operator&() { return &p; }
    T* operator->() { return p; }
};

// Media Foundation is loaded at runtime: Windows "N" editions ship without it, and a
// hard link would stop audio-prep from starting at all, even for WAV and MP3.
struct MediaFoundation {
    HMODULE plat = LoadLibraryW(L"mfplat.dll");
    HMODULE readwrite = LoadLibraryW(L"mfreadwrite.dll");
    decltype(&MFStartup) startup = plat ? (decltype(&MFStartup))GetProcAddress(plat, "MFStartup") : nullptr;
    decltype(&MFShutdown) shutdown = plat ? (decltype(&MFShutdown))GetProcAddress(plat, "MFShutdown") : nullptr;
    decltype(&MFCreateMediaType) createMediaType =
        plat ? (decltype(&MFCreateMediaType))GetProcAddress(plat, "MFCreateMediaType") : nullptr;
    decltype(&MFCreateSourceReaderFromURL) createSourceReader =
        readwrite ? (decltype(&MFCreateSourceReaderFromURL))GetProcAddress(readwrite, "MFCreateSourceReaderFromURL") : nullptr;

    bool available() const { return startup && shutdown && createMediaType && createSourceReader; }
};

std::string hresult(const char* what, HRESULT hr) {
    char buf[96];
    snprintf(buf, sizeof(buf), "%s (0x%08lx)", what, (unsigned long)hr);
    return buf;
}

bool readAll(const MediaFoundation& mf, const std::string& path, DecodedAudio& out, std::string& error) {
    Com<IMFSourceReader> reader;
    HRESULT hr = mf.createSourceReader(widen(path).c_str(), nullptr, &reader);
    if (FAILED(hr)) return error = hresult("cannot open file", hr), false;

    reader->SetStreamSelection(MF_SOURCE_READER_ALL_STREAMS, FALSE);
    hr = reader->SetStreamSelection(MF_SOURCE_READER_FIRST_AUDIO_STREAM, TRUE);
    if (FAILED(hr)) return error = "no audio track found", false;

    Com<IMFMediaType> type;
    mf.createMediaType(&type);
    type->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Audio);
    // Ask only for float samples; rate and channel count stay as in the file and
    // audio-prep resamples and downmixes afterwards.
    type->SetGUID(MF_MT_SUBTYPE, MFAudioFormat_Float);
    hr = reader->SetCurrentMediaType(MF_SOURCE_READER_FIRST_AUDIO_STREAM, nullptr, type.p);
    if (FAILED(hr)) return error = hresult("unsupported audio format", hr), false;

    Com<IMFMediaType> actual;
    reader->GetCurrentMediaType(MF_SOURCE_READER_FIRST_AUDIO_STREAM, &actual);
    UINT32 channels = 0, rate = 0;
    actual->GetUINT32(MF_MT_AUDIO_NUM_CHANNELS, &channels);
    actual->GetUINT32(MF_MT_AUDIO_SAMPLES_PER_SECOND, &rate);
    if (channels == 0 || rate == 0) return error = "unknown audio format", false;

    for (;;) {
        DWORD flags = 0;
        Com<IMFSample> sample;
        hr = reader->ReadSample(MF_SOURCE_READER_FIRST_AUDIO_STREAM, 0, nullptr, &flags, nullptr, &sample);
        if (FAILED(hr)) return error = hresult("decoding failed", hr), false;
        if (flags & MF_SOURCE_READERF_ENDOFSTREAM) break;
        if (!sample.p) continue;

        Com<IMFMediaBuffer> buffer;
        if (FAILED(sample->ConvertToContiguousBuffer(&buffer))) continue;
        BYTE* data = nullptr;
        DWORD length = 0;
        if (SUCCEEDED(buffer->Lock(&data, nullptr, &length))) {
            size_t offset = out.samples.size();
            out.samples.resize(offset + length / sizeof(float));
            memcpy(out.samples.data() + offset, data, length - length % sizeof(float));
            buffer->Unlock();
        }
    }

    if (out.samples.empty()) return error = "no audio frames", false;
    out.sampleRate = rate;
    out.channels = channels;
    return true;
}

} // namespace

bool decodeWithSystem(const std::string& path, DecodedAudio& out, std::string& error) {
    MediaFoundation mf;
    if (!mf.available()) {
        error = "Windows Media Foundation is not installed";
        return false;
    }
    HRESULT co = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(mf.startup(MF_VERSION, MFSTARTUP_FULL))) {
        if (SUCCEEDED(co)) CoUninitialize();
        error = "Media Foundation failed to start";
        return false;
    }
    bool ok = readAll(mf, path, out, error);
    mf.shutdown();
    if (SUCCEEDED(co)) CoUninitialize();
    return ok;
}
