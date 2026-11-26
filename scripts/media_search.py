"""Liste candidatos do Wikimedia Commons com procedência e licença para revisão."""
import argparse
import html
import json
from pathlib import Path
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def search(query):
    params = {"action":"query","format":"json","generator":"search","gsrsearch":query,
              "gsrnamespace":6,"gsrlimit":8,"prop":"imageinfo","iiprop":"url|extmetadata|mime"}
    request = Request("https://commons.wikimedia.org/w/api.php?"+urlencode(params),
                      headers={"User-Agent":"MotionStudio/4.0 (https://github.com/lucasnasss/skill-motion-studio)"})
    with urlopen(request,timeout=30) as response:
        data = json.load(response)
    if "error" in data:
        raise RuntimeError(data["error"].get("info","Erro do Commons"))
    for page in data.get("query",{}).get("pages",{}).values():
        for item in page.get("imageinfo",[]):
            meta = item.get("extmetadata",{})
            def field(name):
                return html.unescape(re.sub("<[^>]+>","",meta.get(name,{}).get("value",""))).strip()
            if item["mime"].startswith(("image/","video/")) and field("LicenseShortName") and field("Artist"):
                yield {"title":page["title"],"page":item["descriptionurl"],"url":item["url"],"mime":item["mime"],
                       "author":field("Artist"),"license":field("LicenseShortName"),"licenseUrl":field("LicenseUrl"),
                       "conditions":field("UsageTerms"),"restrictions":field("Restrictions")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query")
    parser.add_argument("manifest",type=Path)
    args = parser.parse_args()
    candidates = list(search(args.query))
    with args.manifest.open("x",encoding="utf-8") as out:
        json.dump({"version":"1.0","query":args.query,"candidates":candidates},out,ensure_ascii=False,indent=2)
