#pragma once

#include <cstdint>
#include <string>
#include <vector>

struct DecodedAudio {
    std::vector<float> samples; // interleaved
    uint32_t sampleRate = 0;
    uint32_t channels = 0;
};

// Decodes with the OS media framework (AVFoundation on macOS, Media Foundation on
// Windows), which covers what miniaudio can't: AAC/M4A, ALAC, AIFF, and the audio
// inside MP4/MOV video. Output is interleaved float described by sampleRate and
// channels. Path is UTF-8.
bool decodeWithSystem(const std::string& path, DecodedAudio& out, std::string& error);
