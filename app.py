from __future__ import annotations

import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from dashboard_parser import WorkbookDashboardStore

BASE_DIR = Path(__file__).resolve().parent

candidate_paths = [
    Path("C:/Users/320320898/Downloads/VCP - Execution sheet 1.xlsx"),
    Path("C:/Users/320320898/OneDrive - Philips/Desktop/VCP-Dashboard/VCP - Execution sheet 1.xlsx"),
    BASE_DIR / "data" / "VCP - Execution sheet 1.xlsx",
]

valid_candidates = []
for p in candidate_paths:
    try:
        resolved = p.expanduser().resolve()
        if resolved.exists():
            valid_candidates.append((resolved, resolved.stat().st_mtime))
    except Exception:
        pass

if valid_candidates:
    valid_candidates.sort(key=lambda x: x[1], reverse=True)
    DEFAULT_EXCEL_PATH = valid_candidates[0][0]
else:
    DEFAULT_EXCEL_PATH = BASE_DIR / "data" / "VCP - Execution sheet 1.xlsx"

EXCEL_PATH = Path(os.getenv("EXCEL_PATH", str(DEFAULT_EXCEL_PATH))).expanduser().resolve()

if not EXCEL_PATH.exists():
    raise FileNotFoundError(
        f"Excel workbook not found: {EXCEL_PATH}. Set EXCEL_PATH to the workbook you want to monitor."
    )

store = WorkbookDashboardStore(EXCEL_PATH)

app = FastAPI(
    title="Value Creation Plan Live Dashboard",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.middleware("http")
async def disable_api_cache(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response


@app.get("/", include_in_schema=False)
def dashboard_page() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/api/dashboard")
def dashboard_data(
    function_name: str | None = Query(default=None, alias="function"),
    year: int | None = Query(default=None),
) -> JSONResponse:
    try:
        return JSONResponse(store.dashboard_payload(function_name=function_name, year=year))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read dashboard data: {exc}") from exc


@app.get("/api/version")
def dashboard_version() -> JSONResponse:
    try:
        return JSONResponse(store.version_payload())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not read workbook version: {exc}") from exc


@app.post("/api/refresh")
def force_refresh() -> JSONResponse:
    try:
        snapshot = store.snapshot(force=True)
        return JSONResponse(
            {
                "ok": True,
                "version": snapshot["source"]["version"],
                "modified_display": snapshot["source"]["modified_display"],
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not refresh workbook: {exc}") from exc


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "excel_path": str(EXCEL_PATH)}


import base64
from fastapi.responses import Response, JSONResponse

@app.post("/api/export-png")
async def export_png(request: Request) -> Response:
    try:
        data = await request.json()
        image_data = data.get("image", "")
        year = data.get("year", "2026")
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        image_bytes = base64.b64decode(image_data)
        filename = f"VCP_Executive_OnePager_{year}.png"
        return Response(
            content=image_bytes,
            media_type="image/png",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "image/png"
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PNG export failed: {exc}") from exc


@app.post("/api/save-one-pager-png")
async def save_one_pager_png(request: Request) -> JSONResponse:
    try:
        data = await request.json()
        image_data = data.get("image", "")
        year = data.get("year", "2026")
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        image_bytes = base64.b64decode(image_data)
        
        # Save to static exports for direct web viewing
        exports_dir = BASE_DIR / "static" / "exports"
        exports_dir.mkdir(parents=True, exist_ok=True)
        file_path = exports_dir / f"VCP_Executive_OnePager_{year}.png"
        with open(file_path, "wb") as f:
            f.write(image_bytes)
            
        # Write directly to user Downloads folder
        downloads_dir = Path.home() / "Downloads"
        if downloads_dir.exists():
            user_dl_path = downloads_dir / f"VCP_Executive_OnePager_{year}.png"
            with open(user_dl_path, "wb") as f:
                f.write(image_bytes)

        return JSONResponse({
            "ok": True,
            "url": f"/static/exports/VCP_Executive_OnePager_{year}.png?t={int(os.path.getmtime(file_path))}",
            "filename": f"VCP_Executive_OnePager_{year}.png"
        })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Direct PNG save failed: {exc}") from exc


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
