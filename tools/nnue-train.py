#!/usr/bin/env python3
"""NNUE step 2: feature encoding + small numpy MLP, trained on gen0 JSONL.

Feature plan (HalfKP-style adapted to 9×9 fairy chess):
- Piece-square one-hot: 81 squares × 10 piece types × 2 colors = 1620 inputs
- Side-to-move plane: perspective is the MOVER (board is flipped for black)
- Targets: game result (WDL as single scalar 0/0.5/1) + search score (tanh-scaled)

Net: 1620 → 256 → 32 → 1 (ReLU), sigmoid output trained with MSE on result,
plus auxiliary MSE on score (weight 0.15). Pure numpy forward/backward —
dataset is tiny (10k), so no framework needed.

Usage: .venv-nnue/bin/python tools/nnue-train.py [--epochs=40] [--hidden=256]
Output: data/nnue_gen0_weights.npz + validation metrics.
"""
import json
import sys
import numpy as np

rng = np.random.default_rng(12345)

PIECE_INDEX = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6}  # type → channel
N_TYPES = 7
COLOR_SHIFT = N_TYPES  # second block of channels = white pieces
PLANES = 2 * N_TYPES
SQ = 81


def encode(board, turn):
    """81×planes binary matrix; from MOVER's perspective (flip board for black)."""
    x = np.zeros((SQ, PLANES), dtype=np.float32)
    for sq in range(SQ):
        p = board[sq]
        if p == 0:
            continue
        t = PIECE_INDEX[p & 15]
        white = (p >> 4) & 1 == 0  # COLOR_WHITE=16 → bit4=0
        ch = t if white else t + COLOR_SHIFT
        view_sq = sq if turn == "white" else 80 - sq
        x[view_sq, ch] = 1.0
    return x


def load(path):
    X, y_res, y_score = [], [], []
    with open(path) as f:
        for line in f:
            s = json.loads(line)
            X.append(encode(s["b"], s["turn"]).ravel())
            y_res.append(s["result"])
            y_score.append(np.tanh(s["score"] / 1000.0))
    return (
        np.stack(X).astype(np.float32),
        np.array(y_res, dtype=np.float32),
        np.array(y_score, dtype=np.float32),
    )


class MLP:
    def __init__(self, sizes=(PLANES * SQ, 256, 256, 32, 1)):
        self.w, self.b = [], []
        for i in range(len(sizes) - 1):
            fan_in = sizes[i]
            self.w.append(rng.normal(0, np.sqrt(2 / fan_in), (fan_in, sizes[i + 1])).astype(np.float32))
            self.b.append(np.zeros(sizes[i + 1], dtype=np.float32))

    def forward(self, x):
        acts = [x]
        for i in range(len(self.w) - 1):
            x = np.maximum(x @ self.w[i] + self.b[i], 0)
            acts.append(x)
        out = 1 / (1 + np.exp(-(x @ self.w[-1] + self.b[-1])))
        return out, acts

    def train(self, X, y, epochs, lr=1e-3, batch=256, score_target=None, score_w=0.15):
        n = len(X)
        for ep in range(epochs):
            idx = rng.permutation(n)
            tot_loss = 0.0
            for start in range(0, n, batch):
                sel = idx[start:start + batch]
                xb, yb = X[sel], y[sel]
                sb = score_target[sel]
                out, acts = self.forward(xb)
                # combined target: result primary, score auxiliary
                err = (out.ravel() - yb) + score_w * ((out.ravel() - yb) * 0 + (out.ravel() - sb))
                d_out = err.reshape(-1, 1)
                # sigmoid+MSE derivative folded into err above; backprop:
                grad_w = [None] * len(self.w)
                grad_b = [None] * len(self.b)
                delta = d_out * out.ravel().reshape(-1, 1) * (1 - out.ravel().reshape(-1, 1))
                for i in range(len(self.w) - 1, -1, -1):
                    grad_w[i] = acts[i].T @ delta
                    grad_b[i] = delta.sum(axis=0)
                    if i > 0:
                        delta = (delta @ self.w[i].T) * (acts[i] > 0)
                for i in range(len(self.w)):
                    self.w[i] -= lr * grad_w[i] / len(sel)
                    self.b[i] -= lr * grad_b[i].mean(axis=0) if grad_b[i].ndim > 1 else lr * grad_b[i] / len(sel)
                tot_loss += float(((out.ravel() - yb) ** 2).sum())
            if ep % 10 == 0 or ep == epochs - 1:
                print(f"epoch {ep}: loss={tot_loss / n:.4f}")

    def predict(self, X):
        out, _ = self.forward(X)
        return out.ravel()


def main():
    args = {}
    for a in sys.argv[1:]:
        if a.startswith("--") and "=" in a:
            k, v = a.split("=", 1)
            args[k.lstrip("-")] = v
    epochs = int(args.get("epochs", 40))
    data_path = args.get("data", "data/nnue_gen0_d3.jsonl")

    X, y_res, y_score = load(data_path)
    n = len(X)
    perm = rng.permutation(n)
    cut = int(0.9 * n)
    tr, va = perm[:cut], perm[cut:]
    print(f"samples: {n} (train {len(tr)}, val {len(va)})")

    net = MLP()
    net.train(X[tr], y_res[tr], epochs, score_target=y_score[tr])

    pv = net.predict(X[va])
    # Validation metric: sign agreement on decisive games + MAE
    res_v, sc_v = y_res[va], y_score[va]
    mae = float(np.abs(pv - res_v).mean())
    dec = res_v != 0.5
    agree = float(((pv[dec] > 0.5) == (res_v[dec] > 0.5)).mean())
    corr = float(np.corrcoef(pv, res_v)[0, 1])
    print(f"val MAE={mae:.4f} decisive-agreement={agree:.3f} corr(result)={corr:.3f}")

    out_path = args.get("out", "data/nnue_gen0_weights.npz")
    np.savez_compressed(
        out_path,
        **{f"w{i}": w for i, w in enumerate(net.w)},
        **{f"b{i}": b for i, b in enumerate(net.b)},
    )
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
