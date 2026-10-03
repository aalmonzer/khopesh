# Third-party notices

Khopesh is MIT-licensed. It builds on the work below; thank you to everyone involved.

## The separation model (downloaded on first run, not bundled)

**Mel-Band RoFormer "deux"** by [becruily](https://huggingface.co/becruily/mel-band-roformer-deux),
converted to GGUF by [chenmozhijin](https://huggingface.co/chenmozhijin/BSRoformer-GGUF).
Licensed under **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)**: you may share and adapt it with
credit, **for non-commercial purposes only**. Khopesh downloads it directly from Hugging Face and checks its SHA-256.
If you want to use the model's output commercially, ask the model's author.

## Bundled with the app

| Component | Used for | License |
| --- | --- | --- |
| [BSRoformer.cpp](https://github.com/chenmozhijin/BSRoformer.cpp) © 2026 沉默の金 (chenmozhijin) | Running the model (`bs_roformer-cli`) | MIT |
| [ggml](https://github.com/ggml-org/ggml) © 2023–2026 The ggml authors | Tensor library behind the separator (Metal, Vulkan, CUDA, CPU) | MIT |
| [miniaudio](https://github.com/mackron/miniaudio) by David Reid | Decoding WAV, MP3 and FLAC in `audio-prep` | Public domain or MIT-0 |
| [r8brain-free-src](https://github.com/avaneev/r8brain-free-src) © 2013–2026 Aleksey Vaneev | High-quality resampling in `audio-prep` | MIT |
| ↳ Ooura FFT © 1996–2001 Takuya Ooura | FFT inside r8brain | Free use with notice |
| ↳ PFFFT © 2013 Julien Pommier, FFTPACK © 2004 UCAR | Optional FFT inside r8brain | BSD-style (FFTPACK) |
| [Electron](https://www.electronjs.org/) | App shell | MIT (Chromium licenses ship with the app) |
| [React](https://react.dev/) | Interface | MIT |

The Windows builds of `bs_roformer-cli` are the official [BSRoformer.cpp v0.1.0 release](https://github.com/chenmozhijin/BSRoformer.cpp/releases/tag/v0.1.0)
binaries. The macOS build is compiled from source by `npm run setup`.

## MIT license text

The MIT-licensed components above are distributed under these terms, with their copyright lines as listed:

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

License files for the vendored sources live next to them in `native/audio-prep/vendor/`
(miniaudio's is at the end of `miniaudio.h`).
