"""Encode actual, unchanged UI screenshot frames for the README walkthrough."""
from pathlib import Path
from PIL import Image
folder = Path(__file__).resolve().parents[1] / 'docs' / 'media'
names = ['scopes', 'layers', 'sequence-dark', 'core']
frames = [Image.open(folder / f'business-review-{name}.png').convert('RGB') for name in names]
frames[0].save(folder / 'business-flow-review.gif', save_all=True,
               append_images=frames[1:], duration=2600, loop=0, optimize=True)
with Image.open(folder / 'business-flow-review.gif') as result:
    assert result.n_frames == 4
    assert result.size == (1440, 900)
    print(f'{result.n_frames} actual screenshot frames · {result.size}')
