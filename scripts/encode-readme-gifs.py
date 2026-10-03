"""Encode captured UI frames with Pillow. No synthetic frames or private data."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
output = root / 'docs/media'
output.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root/'artifacts/readme-recording/manifest.json').read_text())
for scene in manifest['animations']:
    directory = root/'artifacts/readme-recording'/scene['name']
    files = sorted(directory.glob('*.png'))
    images = [Image.open(p).convert('RGB').resize((1120,700), Image.Resampling.LANCZOS) for p in files]
    # One shared palette avoids colors flickering between frames.
    sampled = images[::max(1, len(images)//12)]
    swatch = Image.new('RGB', (280,175*len(sampled)))
    for index, im in enumerate(sampled):
        swatch.paste(im.resize((280,175)), (0,index*175))
    palette = swatch.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    frames = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]
    times=scene['times']
    durations=[max(80, round((times[i+1]-times[i])/10)*10) for i in range(len(times)-1)]+[1200]
    target=output/(scene['name']+'.gif')
    frames[0].save(target,save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True,disposal=1)
    with Image.open(target) as check:
        assert check.n_frames >= 5 and check.size == (1120,700)
        print(f'{target.name}: {check.n_frames} frames, {target.stat().st_size:,} bytes')
