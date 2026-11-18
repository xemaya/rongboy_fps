# Derive tangent normals and neutral micro-albedo from the dedicated image_gen wool tile.
# Per-character colours remain constant; no scene lighting or broad coloured noise is projected.
from PIL import Image,ImageFilter
from pathlib import Path
import numpy as np
b=Path(__file__).resolve().parents[2]/'assets/rongboy/zombies-v6'
tile=Image.open(b/'design/felt-fibre-tile.png').convert('L').resize((1024,1024),Image.Resampling.LANCZOS)
h=np.asarray(tile,dtype=np.float32)/255;h-=np.asarray(tile.filter(ImageFilter.GaussianBlur(13)),dtype=np.float32)/255
gx=(np.roll(h,-1,1)-np.roll(h,1,1))*2.4;gy=(np.roll(h,-1,0)-np.roll(h,1,0))*2.4
n=np.stack([-gx,gy,np.ones_like(h)],axis=2);n/=np.linalg.norm(n,axis=2,keepdims=True)
Image.fromarray(np.dstack([np.uint8(np.clip(n*.5+.5,0,1)*255),np.uint8(np.clip(.4+h*4.0,.06,.96)*255)]),'RGBA').save(b/'felt-normal.png')
print('Dedicated wool tile baked as micro-normal + neutral fibre albedo')
