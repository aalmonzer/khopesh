cmake_minimum_required(VERSION 3.20)
project(audio-prep LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(APPLE)
    enable_language(OBJCXX)
    set(SYSTEM_DECODER decode_apple.mm)
elseif(WIN32)
    set(SYSTEM_DECODER decode_windows.cpp)
else()
    set(SYSTEM_DECODER decode_none.cpp)
endif()

add_executable(audio-prep main.cpp ${SYSTEM_DECODER})
target_include_directories(audio-prep PRIVATE ${CMAKE_SOURCE_DIR}/vendor/r8brain-free-src)

if(APPLE)
    set_source_files_properties(decode_apple.mm PROPERTIES COMPILE_FLAGS "-fobjc-arc")
    target_link_libraries(audio-prep PRIVATE
        "-framework Foundation"
        "-framework AVFoundation"
        "-framework CoreMedia"
        "-framework CoreFoundation"
        "-framework CoreAudio"
        "-framework AudioToolbox")
elseif(WIN32)
    target_link_libraries(audio-prep PRIVATE shell32 ole32 mfuuid)
    if(MSVC)
        # Static C++ runtime: no Visual C++ Redistributable needed for this tool.
        set_property(TARGET audio-prep PROPERTY MSVC_RUNTIME_LIBRARY "MultiThreaded")
    endif()
    if(MINGW)
        # Self-contained .exe: no MinGW runtime DLLs to ship.
        target_link_options(audio-prep PRIVATE -static)
    endif()
else()
    find_package(Threads REQUIRED)
    target_link_libraries(audio-prep PRIVATE Threads::Threads m dl)
endif()
