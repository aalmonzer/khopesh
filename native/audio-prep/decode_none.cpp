#include "decode.h"

bool decodeWithSystem(const std::string&, DecodedAudio&, std::string& error) {
    error = "format not supported on this platform";
    return false;
}
