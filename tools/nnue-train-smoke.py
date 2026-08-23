"""Smoke test: throughput on the big gen0 dataset with the wider net."""
import time
import numpy as np

exec(open('tools/nnue-train.py').read().split('def main')[0])
X, y_res, y_score = load('data/nnue_gen0_big_d3.jsonl')
print('loaded', X.shape)
net = MLP()
t = time.time()
net.train(X[:5000], y_res[:5000], 2, score_target=y_score[:5000])
print(f"2 epochs on 5k: {time.time()-t:.1f}s")
