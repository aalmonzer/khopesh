#import <AVFoundation/AVFoundation.h>

#include "decode.h"

static std::string describe(NSError* err, const char* fallback) {
    return err ? std::string(err.localizedDescription.UTF8String) : std::string(fallback);
}

bool decodeWithSystem(const std::string& path, DecodedAudio& out, std::string& error) {
    @autoreleasepool {
        NSURL* url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:path.c_str()]];
        AVURLAsset* asset = [AVURLAsset URLAssetWithURL:url options:nil];

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
        // The async replacement needs a run loop; this is a short-lived CLI.
        NSArray<AVAssetTrack*>* tracks = [asset tracksWithMediaType:AVMediaTypeAudio];
#pragma clang diagnostic pop
        if (tracks.count == 0) {
            error = "no audio track found";
            return false;
        }

        NSError* err = nil;
        AVAssetReader* reader = [AVAssetReader assetReaderWithAsset:asset error:&err];
        if (!reader) {
            error = describe(err, "cannot open file");
            return false;
        }

        // Float samples at the file's own rate and channel count; audio-prep does the
        // resampling and a clip-safe downmix itself, same as for every other format.
        NSDictionary* settings = @{
            AVFormatIDKey : @(kAudioFormatLinearPCM),
            AVLinearPCMBitDepthKey : @32,
            AVLinearPCMIsFloatKey : @YES,
            AVLinearPCMIsBigEndianKey : @NO,
            AVLinearPCMIsNonInterleaved : @NO,
        };
        AVAssetReaderAudioMixOutput* output =
            [AVAssetReaderAudioMixOutput assetReaderAudioMixOutputWithAudioTracks:tracks audioSettings:settings];
        if (![reader canAddOutput:output]) {
            error = "unsupported audio format";
            return false;
        }
        [reader addOutput:output];
        if (![reader startReading]) {
            error = describe(reader.error, "cannot start reading");
            return false;
        }

        while (CMSampleBufferRef buffer = [output copyNextSampleBuffer]) {
            if (out.channels == 0) {
                const AudioStreamBasicDescription* format =
                    CMAudioFormatDescriptionGetStreamBasicDescription(CMSampleBufferGetFormatDescription(buffer));
                if (format) {
                    out.sampleRate = (uint32_t)format->mSampleRate;
                    out.channels = format->mChannelsPerFrame;
                }
            }
            CMBlockBufferRef block = CMSampleBufferGetDataBuffer(buffer);
            if (block) {
                size_t length = CMBlockBufferGetDataLength(block);
                size_t offset = out.samples.size();
                out.samples.resize(offset + length / sizeof(float));
                CMBlockBufferCopyDataBytes(block, 0, length, out.samples.data() + offset);
            }
            CFRelease(buffer);
        }

        if (reader.status != AVAssetReaderStatusCompleted) {
            error = describe(reader.error, "decoding failed");
            return false;
        }
        if (out.samples.empty() || out.channels == 0 || out.sampleRate == 0) {
            error = "no audio frames";
            return false;
        }
        return true;
    }
}
