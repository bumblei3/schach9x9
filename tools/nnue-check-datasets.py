"""Check result distribution of gen2 vs gen0-big datasets."""
import json

for f in ["data/nnue_gen0_big_d3.jsonl", "data/nnue_gen2_d4.jsonl"]:
    res = {}
    for line in open(f):
        s = json.loads(line)
        res[s["result"]] = res.get(s["result"], 0) + 1
    print(f, res)
