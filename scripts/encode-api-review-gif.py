"""Encode unchanged screenshot frames into the README walkthrough (requires Pillow)."""
from pathlib import Path
from PIL import Image

folder = Path(__file__).resolve().parents[1] / 'docs' / 'media'
names = ['capture', 'scopes', 'refund', 'sequence-dark']
frames = [Image.open(folder / f'api-review-{name}.png').convert('RGB') for name in names]
frames[0].save(folder / 'api-flow-review.gif', save_all=True,
               append_images=frames[1:], duration=2400, loop=0, optimize=True)
with Image.open(folder / 'api-flow-review.gif') as result:
    assert result.n_frames == 4
    assert result.size == (1440, 900)
    print(f'{result.n_frames} actual screenshot frames · {result.size}')
