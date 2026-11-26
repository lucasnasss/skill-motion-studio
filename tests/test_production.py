import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from image_to_3d import geometry, export_glb


class MeshTests(unittest.TestCase):
    def test_opaque_reference_requires_cutout(self):
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp)/"opaque.png"
            Image.new("RGB",(5,5)).save(file)
            with self.assertRaises(ValueError):
                list(geometry(file,16,.25))

    def test_both_methods_write_reopenable_binary_chunks(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp)/"cutout.png"
            image = Image.new("RGBA",(8,8))
            image.paste("red",(1,1,7,7))
            image.save(source)
            for name,side in (("front",None),("pair",source)):
                mesh = list(geometry(source,8,.2,side))
                out = Path(temp)/(name+".glb")
                export_glb(mesh,out)
                data = out.read_bytes()
                magic,version,total,meta_length,kind = struct.unpack_from("<4sIII4s",data)
                self.assertEqual((magic,version,total,kind),(b"glTF",2,len(data),b"JSON"))
                meta = json.loads(data[20:20+meta_length])
                self.assertEqual(meta["accessors"][0]["count"],len(mesh)*6)
                self.assertEqual(meta["buffers"][0]["byteLength"],len(data)-28-meta_length)


if __name__=="__main__":
    unittest.main()
