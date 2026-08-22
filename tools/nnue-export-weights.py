#!/usr/bin/env python3
"""Export nnue-train.py weights (.npz) to JSON for the JS inference (js/ai/nnue.ts)."""
import sys
import json
import numpy as np

npz = np.load(sys.argv[1] if len(sys.argv) > 1 else "data/nnue_gen0_weights.npz")
w = {k: npz[k] for k in npz.files}
shape = [w["w0"].shape[0], w["w0"].shape[1], w["w1"].shape[1], 1]
out = {
    "shape": shape,
    "w0": w["w0"].ravel().tolist(),
    "b0": w["b0"].tolist(),
    "w1": w["w1"].ravel().tolist(),
    "b1": w["b1"].tolist(),
    "w2": w["w2"].ravel().tolist(),
    "b2": w["b2"].tolist(),
}
path = sys.argv[2] if len(sys.argv) > 2 else "data/nnue_weights.json"
with open(path, "w") as f:
    json.dump(out, f)
print(f"wrote {path} shape={shape} size={len(json.dumps(out))//1024}KB")
