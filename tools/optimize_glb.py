"""Slims the dumpling character GLB for the web.

The site squishes the character by scaling its root, so the morph targets
are not needed; the materials have no textures, so UVs are dropped too.
Normals and vertex colours are quantized (KHR_mesh_quantization), which
three.js reads natively. Positions and indices are kept as they are.

    python tools/optimize_glb.py <input.glb> <output.glb>
"""
import json
import struct
import sys

import numpy as np

COMPONENT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    data = open(path, "rb").read()
    json_len = struct.unpack("<I", data[12:16])[0]
    gltf = json.loads(data[20:20 + json_len])
    bin_start = 20 + json_len
    bin_len = struct.unpack("<I", data[bin_start:bin_start + 4])[0]
    return gltf, data[bin_start + 8:bin_start + 8 + bin_len]


def read_accessor(gltf, binary, index):
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    dtype = np.dtype(COMPONENT[acc["componentType"]])
    width = WIDTH[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride", dtype.itemsize * width)
    raw = np.frombuffer(binary, dtype=np.uint8, count=stride * (acc["count"] - 1) + dtype.itemsize * width, offset=start)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(acc["count"], dtype.itemsize * width), strides=(stride, 1))
    values = np.ascontiguousarray(rows).view(dtype).reshape(acc["count"], width).astype(np.float64)
    if acc.get("normalized"):
        values /= np.iinfo(dtype).max
    return acc, values


class Writer:
    def __init__(self):
        self.blob = bytearray()
        self.views = []
        self.accessors = []

    def add(self, array, component, kind, normalized=False, stride=None, target=None, minmax=False):
        while len(self.blob) % 4:
            self.blob.append(0)
        offset = len(self.blob)
        count, width = array.shape if array.ndim == 2 else (array.shape[0], 1)
        packed = array.reshape(count, width)
        if stride:
            padded = np.zeros((count, stride // packed.dtype.itemsize), dtype=packed.dtype)
            padded[:, :width] = packed
            packed = padded
        self.blob += packed.tobytes()
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(self.blob) - offset}
        if stride:
            view["byteStride"] = stride
        if target:
            view["target"] = target
        self.views.append(view)
        acc = {"bufferView": len(self.views) - 1, "componentType": component, "count": count, "type": kind}
        if normalized:
            acc["normalized"] = True
        if minmax:
            acc["min"] = array.reshape(count, width).min(axis=0).tolist()
            acc["max"] = array.reshape(count, width).max(axis=0).tolist()
        self.accessors.append(acc)
        return len(self.accessors) - 1


def main(src, dst):
    gltf, binary = read_glb(src)
    out = Writer()
    for mesh in gltf["meshes"]:
        mesh.pop("weights", None)
        mesh.get("extras", {}).pop("targetNames", None)
        for prim in mesh["primitives"]:
            prim.pop("targets", None)
            attrs = {}
            _, pos = read_accessor(gltf, binary, prim["attributes"]["POSITION"])
            attrs["POSITION"] = out.add(pos.astype(np.float32), 5126, "VEC3", target=34962, minmax=True)
            if "NORMAL" in prim["attributes"]:
                _, nrm = read_accessor(gltf, binary, prim["attributes"]["NORMAL"])
                nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
                attrs["NORMAL"] = out.add(np.round(nrm * 127).astype(np.int8), 5120, "VEC3", normalized=True, stride=4, target=34962)
            if "COLOR_0" in prim["attributes"]:
                _, col = read_accessor(gltf, binary, prim["attributes"]["COLOR_0"])
                if col.shape[1] == 3:
                    col = np.hstack([col, np.ones((col.shape[0], 1))])
                attrs["COLOR_0"] = out.add(np.round(np.clip(col, 0, 1) * 255).astype(np.uint8), 5121, "VEC4", normalized=True, target=34962)
            prim["attributes"] = attrs
            if "indices" in prim:
                acc, idx = read_accessor(gltf, binary, prim["indices"])
                kind = np.uint16 if idx.max() < 65535 else np.uint32
                prim["indices"] = out.add(idx.astype(kind).reshape(-1), 5123 if kind is np.uint16 else 5125, "SCALAR", target=34963)
    gltf["accessors"] = out.accessors
    gltf["bufferViews"] = out.views
    while len(out.blob) % 4:
        out.blob.append(0)
    gltf["buffers"] = [{"byteLength": len(out.blob)}]
    for key in ("extensionsUsed", "extensionsRequired"):
        names = set(gltf.get(key, []))
        names.add("KHR_mesh_quantization")
        gltf[key] = sorted(names)
    text = json.dumps(gltf, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    total = 12 + 8 + len(text) + 8 + len(out.blob)
    with open(dst, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(text), 0x4E4F534A) + text)
        f.write(struct.pack("<II", len(out.blob), 0x004E4942) + bytes(out.blob))
    print(f"{dst}: {total // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
