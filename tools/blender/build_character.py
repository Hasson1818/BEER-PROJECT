# Builds the BEER-PROJECT close-up character in Blender: a low-poly soldier/candidate with a 10-bone rig,
# saves shared/engine/assets/character.blend and exports shared/engine/assets/character.json (read by
# shared/engine/detail.js). Run it from Blender's Scripting tab (change REPO below to your clone).
# Coordinates below are the game's (three.js: x right, y up, face looks along +z, feet at y=0).
# They are converted to Blender's (Z up, face toward -Y) when the mesh is created.
import bpy, bmesh, math, json, os
from mathutils import Vector, Matrix, Euler

REPO = r"C:\Users\ניב\Documents\Claude\Projects\BEER-PROJECT"
OUT_JSON = os.path.join(REPO, "shared", "engine", "assets", "character.json")
OUT_BLEND = os.path.join(REPO, "shared", "engine", "assets", "character.blend")


def T(p):
    return Vector((p[0], -p[2], p[1]))


def smooth(a, b, x):
    t = (x - a) / (b - a)
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


BONES = ["body", "hipL", "hipR", "kneeL", "kneeR", "shoulderL", "shoulderR", "elbowL", "elbowR", "head"]
IDX = {b: i for i, b in enumerate(BONES)}
# Joint pivots (head of each bone), the same numbers as in shared/engine/people.js.
PIVOT = {
    "body": (0, 0, 0),
    "hipL": (-0.09, 0.9, 0), "hipR": (0.09, 0.9, 0),
    "kneeL": (-0.09, 0.46, 0), "kneeR": (0.09, 0.46, 0),
    "shoulderL": (-0.23, 1.47, 0), "shoulderR": (0.23, 1.47, 0),
    "elbowL": (-0.23, 1.16, 0), "elbowR": (0.23, 1.16, 0),
    "head": (0, 1.7, 0),
}
REG = dict(skin=0, shirt=1, sleeve=2, pants=3, shoes=4, hair=5, dark=6, shirtDark=7, white=8, shaft=9, hairShort=10, hairLong=11, hairBuzz=12)
REG_COLORS = {
    "skin": (0.80, 0.58, 0.44), "shirt": (0.36, 0.38, 0.21), "sleeve": (0.36, 0.38, 0.21),
    "pants": (0.30, 0.32, 0.18), "shoes": (0.10, 0.10, 0.10), "hair": (0.10, 0.08, 0.06),
    "dark": (0.03, 0.03, 0.03), "shirtDark": (0.24, 0.26, 0.14), "white": (0.95, 0.95, 0.93), "shaft": (0.10, 0.10, 0.10),
    "hairShort": (0.10, 0.08, 0.06), "hairLong": (0.10, 0.08, 0.06), "hairBuzz": (0.10, 0.08, 0.06),
}


def norm(w):
    s = sum(w.values())
    return {k: v / s for k, v in w.items() if v > 1e-4} if s > 0 else {"body": 1.0}


# ---------- weight functions (p = rest position in game coordinates) ----------

def w_torso(p):
    x, y = p[0], p[1]
    ax = abs(x)
    side = "L" if x < 0 else "R"
    head = smooth(1.54, 1.62, y)
    hip = smooth(0.995, 0.8, y) * smooth(0.0, 0.08, ax) * 0.95
    sh = smooth(1.36, 1.46, y) * smooth(0.13, 0.22, ax) * 0.65 * (1 - head)
    w = {"head": head, "body": 1.0}
    w[f"hip{side}"] = hip
    w[f"shoulder{side}"] = sh
    # Body takes what is left.
    w["body"] = max(0.0, 1.0 - head - hip - sh)
    return norm(w)


def w_neck(p):
    h = smooth(1.53, 1.62, p[1])
    return norm({"head": h, "body": 1 - h})


def w_head(p):
    return {"head": 1.0}


def w_arm(side):
    def f(p):
        y = p[1]
        e = smooth(1.22, 1.10, y)
        b = 0.85 * smooth(1.50, 1.56, y)
        return norm({f"elbow{side}": e, f"shoulder{side}": (1 - e) * (1 - b), "body": (1 - e) * b})
    return f


def w_hand(side):
    return lambda p: {f"elbow{side}": 1.0}


def w_leg(side):
    def f(p):
        k = smooth(0.52, 0.40, p[1])
        return norm({f"knee{side}": k, f"hip{side}": 1 - k})
    return f


def w_boot(side):
    return lambda p: {f"knee{side}": 1.0}


# ---------- builder ----------

class Builder:
    def __init__(self):
        self.bm = bmesh.new()
        self.dl = self.bm.verts.layers.deform.verify()

    def vert(self, p, wf):
        v = self.bm.verts.new(T(p))
        for b, w in wf(p).items():
            v[self.dl][IDX[b]] = w
        return v

    def face(self, verts, region):
        f = self.bm.faces.new(verts)
        f.material_index = REG[region]
        return f

    def loft(self, rings, regions, wf, caps=(True, True)):
        vr = [[self.vert(p, wf) for p in ring] for ring in rings]
        n = len(vr[0])
        if isinstance(regions, str):
            regions = [regions] * (len(rings) - 1)
        for k in range(len(vr) - 1):
            for i in range(n):
                self.face((vr[k][i], vr[k][(i + 1) % n], vr[k + 1][(i + 1) % n], vr[k + 1][i]), regions[k])
        if caps[0]:
            self.face(vr[0][::-1], regions[0])
        if caps[1]:
            self.face(vr[-1], regions[-1])

    def box(self, c, size, region, wf, rot=(0, 0, 0)):
        sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
        m = Euler(rot).to_matrix()
        pts = []
        for ix in (-1, 1):
            for iy in (-1, 1):
                for iz in (-1, 1):
                    d = m @ Vector((ix * sx, iy * sy, iz * sz))
                    pts.append((c[0] + d.x, c[1] + d.y, c[2] + d.z))
        vs = [self.vert(p, wf) for p in pts]
        # index = ix*4 + iy*2 + iz  with ix,iy,iz in (0,1)
        quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        for q in quads:
            self.face([vs[i] for i in q], region)

    def pyramid(self, base, apex, region, wf):
        vs = [self.vert(p, wf) for p in base] + [self.vert(apex, wf)]
        n = len(base)
        for i in range(n):
            self.face((vs[i], vs[(i + 1) % n], vs[n]), region)
        self.face(vs[:n][::-1], region)


def ring_xz(cx, y, cz, rx, rz, n=12, power=2.4):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        x = rx * math.copysign(abs(c) ** (2 / power), c)
        z = rz * math.copysign(abs(s) ** (2 / power), s)
        pts.append((cx + x, y, cz + z))
    return pts


def ring_xy(cy, z, cx, hw, hh, n=10, power=2.6):
    # Rings lying in the XY plane (for the foot, which runs along z).
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        c, s = math.cos(a), math.sin(a)
        x = hw * math.copysign(abs(c) ** (2 / power), c)
        y = hh * math.copysign(abs(s) ** (2 / power), s)
        pts.append((cx + x, cy + y, z))
    return pts


def w_hairlong(p):
    h = smooth(1.46, 1.62, p[1])
    return norm({"head": h, "body": 1 - h})


def hair(b, kind):
    """A hair cap that follows the skull; the hairline is high on the forehead and low at the nape."""
    R = 0.115 * {"short": 1.085, "long": 1.09, "buzz": 1.03}[kind]
    front, side, back = {"short": (60, 80, 106), "long": (58, 80, 112), "buzz": (66, 82, 100)}[kind]
    n, K = 16, 5
    rings = []
    for k in range(1, K + 1):
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / n
            sn = math.sin(a)
            end = math.radians(side + (-(side - front) * sn if sn > 0 else (back - side) * -sn))
            th = end * k / K
            r = R * math.sin(th)
            ring.append((r * 0.97 * math.cos(a), 1.7 + R * 1.04 * math.cos(th), r * 0.97 * sn - 0.004))
        rings.append(ring)
    region = {"short": "hairShort", "long": "hairLong", "buzz": "hairBuzz"}[kind]
    b.loft(rings, region, w_head, caps=(True, False))
    if kind == "long":
        # A curtain of hair down the back to the shoulders.
        panel = [(1.70, 0.098, 0.05, -0.088), (1.62, 0.108, 0.052, -0.098), (1.54, 0.105, 0.05, -0.098), (1.47, 0.092, 0.042, -0.092)]
        b.loft([ring_xz(0, y, cz, rx, rz, n=10, power=3.0) for y, rx, rz, cz in panel], region, w_hairlong)


def build():
    b = Builder()

    # ----- torso: shirt above the belt, trousers below -----
    torso = [
        (0.90, 0.15, 0.095), (0.93, 0.18, 0.108), (0.98, 0.17, 0.103),
        (1.02, 0.163, 0.098), (1.12, 0.168, 0.102), (1.24, 0.18, 0.11),
        (1.36, 0.195, 0.12), (1.45, 0.205, 0.108), (1.50, 0.15, 0.09),
        (1.53, 0.085, 0.07), (1.555, 0.05, 0.05),
    ]
    rings = [ring_xz(0, y, 0.0, rx, rz, n=16, power=2.6) for y, rx, rz in torso]
    regions = ["pants", "pants", "shirt", "shirt", "shirt", "shirt", "shirt", "shirt", "shirt", "shirt"]
    b.loft(rings, regions, w_torso)
    # Belt, buckle, collar, pockets, shoulder tabs.
    belt = [(0.965, 0.176, 0.108), (0.99, 0.178, 0.108), (1.025, 0.172, 0.104)]
    b.loft([ring_xz(0, y, 0.0, rx + 0.004, rz + 0.004, n=16, power=2.6) for y, rx, rz in belt], "dark", w_torso)
    b.box((0, 0.995, 0.113), (0.03, 0.03, 0.01), "white", w_torso)
    collar = [(1.495, 0.095, 0.078), (1.525, 0.078, 0.064), (1.56, 0.062, 0.052)]
    b.loft([ring_xz(0, y, 0.0, rx, rz, n=14) for y, rx, rz in collar], "shirtDark", w_neck)
    for sx in (-1, 1):
        b.box((sx * 0.092, 1.235, 0.117), (0.062, 0.07, 0.01), "shirtDark", w_torso, rot=(0, 0, 0))
        b.box((sx * 0.185, 1.47, 0.0), (0.075, 0.012, 0.055), "shirtDark", w_torso)

    # ----- neck and head -----
    b.loft([ring_xz(0, y, 0.0, r, r, n=10) for y, r in [(1.53, 0.05), (1.59, 0.046), (1.65, 0.045)]], "skin", w_neck)
    R = 0.115
    nu, nv = 14, 10
    head_rings = []
    for i in range(1, nv):
        th = math.pi * i / nv
        ly = R * 1.04 * math.cos(th)
        r = R * math.sin(th)
        chin = 1 - 0.2 * smooth(0.0, -R, ly)
        head_rings.append(ring_xz(0, 1.7 + ly, 0.0, r * 0.97 * chin, r * (1.0 - 0.06 * smooth(0.0, -R, ly)), n=nu, power=2.0))
    b.loft(head_rings, "skin", w_head)
    for sx in (-1, 1):
        b.loft([ring_xz(sx * 0.115, 1.7 + dy, -0.005, rx, rz, n=8, power=2.0) for dy, rx, rz in [(-0.022, 0.005, 0.012), (0.0, 0.01, 0.018), (0.022, 0.005, 0.012)]], "skin", w_head)
        # Eyes: white ball, dark pupil, brow.
        b.loft([ring_xz(sx * 0.04, 1.72 + dy, 0.098, rx, rx * 0.8, n=8, power=2.0) for dy, rx in [(-0.014, 0.008), (0.0, 0.016), (0.014, 0.008)]], "white", w_head)
        b.loft([ring_xz(sx * 0.04, 1.72 + dy, 0.109, rx, rx, n=6, power=2.0) for dy, rx in [(-0.006, 0.005), (0.0, 0.0085), (0.006, 0.005)]], "dark", w_head)
        b.box((sx * 0.041, 1.768, 0.103), (0.038, 0.008, 0.012), "hair", w_head, rot=(0, 0, -sx * 0.18))
    # Nose and mouth.
    b.pyramid([(-0.013, 1.668, 0.106), (0.013, 1.668, 0.106), (0.011, 1.70, 0.108), (-0.011, 1.70, 0.108)], (0, 1.675, 0.131), "skin", w_head)
    b.box((0, 1.645, 0.104), (0.042, 0.007, 0.012), "dark", w_head)

    for kind in ("short", "long", "buzz"):
        hair(b, kind)

    # ----- arms (side -1 = x<0, "L") -----
    for sgn, side in ((-1, "L"), (1, "R")):
        x0 = sgn * 0.23
        upper = [(1.535, 0.035), (1.51, 0.055), (1.46, 0.057), (1.34, 0.051), (1.22, 0.045), (1.16, 0.042)]
        b.loft([ring_xz(x0, y, 0.0, r, r * 1.02, n=12) for y, r in upper], "shirt", w_arm(side), caps=(True, False))
        fore = [(1.16, 0.042), (1.11, 0.043), (1.0, 0.045), (0.9, 0.035), (0.875, 0.03)]
        b.loft([ring_xz(x0, y, 0.0, r, r * 1.03, n=12) for y, r in fore], "sleeve", w_arm(side), caps=(False, False))
        hand = [(0.875, 0.03, 0.027), (0.845, 0.04, 0.022), (0.81, 0.042, 0.02), (0.78, 0.036, 0.018), (0.765, 0.02, 0.012)]
        b.loft([ring_xz(x0, y, 0.01, rx, rz, n=10, power=2.2) for y, rx, rz in hand], "skin", w_hand(side))
        b.box((x0 - sgn * 0.034, 0.83, 0.028), (0.016, 0.05, 0.018), "skin", w_hand(side), rot=(0.25, 0, -sgn * 0.2))

    # ----- legs and boots -----
    for sgn, side in ((-1, "L"), (1, "R")):
        x0 = sgn * 0.09
        thigh = [(0.97, 0.094, 0.098), (0.85, 0.092, 0.095), (0.70, 0.08, 0.084), (0.55, 0.066, 0.07), (0.46, 0.061, 0.064)]
        b.loft([ring_xz(x0, y, 0.0, rx, rz, n=12) for y, rx, rz in thigh], "pants", w_leg(side), caps=(True, False))
        shin = [(0.46, 0.061, 0.064), (0.40, 0.063, 0.07), (0.30, 0.054, 0.058), (0.19, 0.048, 0.05), (0.15, 0.056, 0.058), (0.135, 0.056, 0.058)]
        b.loft([ring_xz(x0, y, 0.0, rx, rz, n=12) for y, rx, rz in shin], "pants", w_leg(side), caps=(False, False))
        # Boot: shaft + foot + sole.
        b.loft([ring_xz(x0, y, 0.0, 0.05, 0.052, n=12) for y, r in [(0.035, 0), (0.09, 0), (0.16, 0)]], "shaft", w_boot(side))
        foot = [(-0.075, 0.032, 0.026), (-0.04, 0.046, 0.036), (0.04, 0.05, 0.036), (0.12, 0.045, 0.03), (0.17, 0.03, 0.021)]
        b.loft([ring_xy(0.045, z, x0, hw, hh, n=10) for z, hw, hh in foot], "shoes", w_boot(side))
        b.box((x0, 0.007, 0.047), (0.098, 0.014, 0.25), "dark", w_boot(side))

    bm = b.bm
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new("Character")
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def make_scene():
    for name in ("Character", "CharacterRig"):
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    if "Cube" in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects["Cube"], do_unlink=True)
    mesh = build()
    for name, col in REG_COLORS.items():
        mat = bpy.data.materials.get("char_" + name) or bpy.data.materials.new("char_" + name)
        mat.diffuse_color = (*col, 1)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (*col, 1)
            bsdf.inputs["Roughness"].default_value = 0.85
        mesh.materials.append(mat)
    obj = bpy.data.objects.new("Character", mesh)
    coll = bpy.data.collections.get("Character") or bpy.data.collections.new("Character")
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    coll.objects.link(obj)
    for b in BONES:
        obj.vertex_groups.new(name=b)
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    mesh.update()

    # Armature with the same pivots.
    arm_data = bpy.data.armatures.new("CharacterRig")
    arm = bpy.data.objects.new("CharacterRig", arm_data)
    coll.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    tails = {
        "body": (0, 0, 0.9) if False else (0, 0.9, 0), "hipL": PIVOT["kneeL"], "hipR": PIVOT["kneeR"],
        "kneeL": (-0.09, 0.04, 0), "kneeR": (0.09, 0.04, 0),
        "shoulderL": PIVOT["elbowL"], "shoulderR": PIVOT["elbowR"],
        "elbowL": (-0.23, 0.85, 0), "elbowR": (0.23, 0.85, 0), "head": (0, 1.92, 0),
    }
    parents = {"hipL": "body", "hipR": "body", "shoulderL": "body", "shoulderR": "body", "head": "body",
               "kneeL": "hipL", "kneeR": "hipR", "elbowL": "shoulderL", "elbowR": "shoulderR"}
    eb = {}
    for name in BONES:
        bone = arm_data.edit_bones.new(name)
        bone.head = T(PIVOT[name])
        bone.tail = T(tails[name])
        eb[name] = bone
    for child, parent in parents.items():
        eb[child].parent = eb[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.parent = arm
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return obj, mesh


def export(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    polys = mesh.polygons
    n_poly = len(polys)
    # Vertex -> polygons, for angle-thresholded smooth normals.
    v2p = {}
    for p in polys:
        for v in p.vertices:
            v2p.setdefault(v, []).append(p.index)
    cos_limit = math.cos(math.radians(55))
    pnorm = [Vector(p.normal) for p in polys]
    parea = [p.area for p in polys]
    names = [vg.name for vg in obj.vertex_groups]

    def vweights(v):
        ws = [(IDX[names[g.group]], g.weight) for g in mesh.vertices[v].groups if g.weight > 1e-4]
        ws.sort(key=lambda t: -t[1])
        ws = ws[:4]
        s = sum(w for _, w in ws) or 1.0
        out = [(i, w / s) for i, w in ws]
        while len(out) < 4:
            out.append((0, 0.0))
        return out

    verts = {}
    pos, nrm, reg, skin, wgt, index = [], [], [], [], [], []
    hair_index = {10: [], 11: [], 12: []}

    def emit(poly, v):
        n = Vector((0, 0, 0))
        for q in v2p[v]:
            if pnorm[poly.index].dot(pnorm[q]) > cos_limit:
                n += pnorm[q] * parea[q]
        n.normalize()
        co = mesh.vertices[v].co
        p3 = (round(co.x, 4), round(co.z, 4), round(-co.y, 4))
        n3 = (round(n.x * 127), round(n.z * 127), round(-n.y * 127))
        ws = vweights(v)
        wq = tuple(round(w * 255) for _, w in ws)
        key = (p3, n3, poly.material_index, tuple(i for i, _ in ws), wq)
        if key not in verts:
            verts[key] = len(pos) // 3
            pos.extend(int(round(c * 10000)) for c in p3)
            nrm.extend(n3)
            reg.append(5 if poly.material_index >= 10 else poly.material_index)
            skin.extend(i for i, _ in ws)
            wgt.extend(wq)
        return verts[key]

    for p in polys:
        vs = [emit(p, v) for v in p.vertices]
        target = hair_index[p.material_index] if p.material_index >= 10 else index
        for k in range(1, len(vs) - 1):
            target.extend((vs[0], vs[k], vs[k + 1]))

    data = {
        "bones": BONES,
        "pivots": {b: PIVOT[b] for b in BONES},
        "regions": list(REG.keys()),
        "pos": pos, "nrm": nrm, "region": reg, "skin": skin, "wgt": wgt, "index": index,
        "hair": {"short": hair_index[10], "long": hair_index[11], "buzz": hair_index[12]},
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    return {"verts": len(reg), "tris": len(index) // 3, "bytes": os.path.getsize(OUT_JSON)}


obj, mesh = make_scene()
info = export(obj)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, copy=True)
info["polys"] = len(mesh.polygons)
info["blend"] = os.path.getsize(OUT_BLEND)
result = info
