"""Adaptador opcional executado dentro do Blender para render determinístico de uma cena JSON."""
from __future__ import annotations
import json
import sys
from pathlib import Path
import bpy


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not argv:
        raise SystemExit("Uso: blender -b --python render_scene.py -- configuracao.json")
    cfg = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    primitive = cfg.get("primitive", "cube")
    if primitive == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add()
    else:
        bpy.ops.mesh.primitive_cube_add()
    obj = bpy.context.active_object
    obj.rotation_euler = cfg.get("rotation", [0.35, 0.2, 0.0])
    material = bpy.data.materials.new("MotionStudioMaterial")
    material.diffuse_color = (*cfg.get("color", [0.42, 0.35, 0.98]), 1.0)
    obj.data.materials.append(material)
    bpy.ops.object.light_add(type="AREA", location=(4, -4, 6))
    bpy.context.active_object.data.energy = 1000
    bpy.ops.object.camera_add(location=(0, -7, 2.5), rotation=(1.25, 0, 0))
    camera = bpy.context.active_object
    bpy.context.scene.camera = camera
    scene = bpy.context.scene
    scene.render.engine = cfg.get("engine", "BLENDER_EEVEE_NEXT")
    scene.render.resolution_x = int(cfg.get("width", 1280))
    scene.render.resolution_y = int(cfg.get("height", 720))
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(Path(cfg.get("output", "blender-frame.png")).resolve())
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
