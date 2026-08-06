# Service Transformation Live Dashboard

A responsive, vertical one-page dashboard driven directly by the supplied VCP Excel workbook. It recreates the visual language of the reference images with:

- Function and year filters
- Three headline cards: total key themes, active key themes and not-started key themes
- A central key-theme bubble with action-item branches
- A cross-functional dependency runway with status dots, shaded progress and a moving ship marker
- Clickable dependency details and management-attention items
- Automatic refresh after the monitored Excel workbook is saved

The supplied workbook is included in `data/VCP - Execution sheet 1.xlsx`.

## Quick start

### Windows

1. Install Python 3.10 or later.
2. Open Command Prompt in this folder.
3. Install the packages once:

```bat
python -m pip install -r requirements.txt
```

4. Start the dashboard:

```bat
run_dashboard.bat
```

5. Open `http://127.0.0.1:8000` in a browser.

### macOS or Linux

```sh
python -m pip install -r requirements.txt
./run_dashboard.sh
```

Then open `http://127.0.0.1:8000`.

## Link the dashboard to your working Excel file

By default, the app watches the workbook inside the project’s `data` folder. To monitor a different workbook, set the `EXCEL_PATH` environment variable before starting the app.

### Windows PowerShell

```powershell
$env:EXCEL_PATH="C:\Users\YourName\OneDrive - Company\VCP - Execution sheet 1.xlsx"
python app.py
```

### macOS or Linux

```sh
export EXCEL_PATH="/Users/yourname/OneDrive/VCP - Execution sheet 1.xlsx"
python app.py
```

A OneDrive- or SharePoint-synchronised local path is the simplest setup. Each time Excel saves the file, the browser detects the new file version within approximately 15 seconds and refreshes the visible selection automatically.

The backend caches the parsed workbook and reloads it only when the file modification time or file size changes. It also retries briefly when Excel is in the middle of saving the file.

## Excel-to-dashboard mapping

The parser reads the function worksheets that use the workbook’s key-theme layout:

| Dashboard field | Excel location |
|---|---|
| Function | Worksheet tab name |
| Year | Year section in column A, such as 2026, 2027 or 2028 |
| Key theme | Column A beneath `Key Themes` |
| Function action descriptions | Column B |
| Function status | Column E |
| Function completion | Column F |
| Function timeline | Column G |
| Dependency function | Header blocks from column H onward |
| Dependency action | First column of each dependency block |
| Dependency timeline | Second column of each dependency block |
| Dependency status | Third column of each dependency block |
| Dependency completion | Fourth column of each dependency block |

The existing status symbols are interpreted as:

| Excel symbol | Completion |
|---|---:|
| ○ | 0% |
| ◔ | 25% |
| ◑ | 50% |
| ◕ | 75% |
| ● | 100% |

Percentage strings such as `█████░░░░░ 50%` are also read directly.

The supplied workbook currently produces **4 total themes, 4 active themes and 0 not-started themes** for Service Transformation in 2026.

## Automatic-update scope

The dashboard updates automatically when you:

- Edit action descriptions
- Change status symbols or completion percentages
- Change timelines
- Add or remove key themes within the existing year-section structure
- Add or change dependency actions within the existing four-column dependency blocks
- Save the monitored workbook

A major structural redesign of the workbook, such as moving the key-theme columns or replacing the dependency block format, may require an adjustment to `dashboard_parser.py`.

The dashboard is read-only. It does not write changes back to Excel.

## Run it for other users

For a shared internal dashboard, run the app on an internal server, Azure App Service, container platform or virtual machine and start it with a network-accessible host:

```sh
HOST=0.0.0.0 PORT=8000 python app.py
```

A Dockerfile and `docker-compose.yml` are included. When exposing the dashboard beyond your own computer, place it behind your organisation’s authentication or reverse proxy. The sample app does not include user authentication.

## Important email limitation

A truly live dashboard with working filters and automatic Excel refresh cannot run inside a normal Outlook or Gmail message body. Standard email clients block arbitrary JavaScript, local-file access and continuous data requests for security reasons.

The live version therefore needs to be hosted as a web app. An email can contain a full visual snapshot generated from the live dashboard, but that snapshot will not have working filters. AMP for Email supports limited interaction in some clients, but it is not consistently supported in Outlook and cannot directly monitor a local Excel workbook.

## Project structure

```text
service-transformation-live-dashboard/
├── app.py                         FastAPI server and API routes
├── dashboard_parser.py            Dynamic Excel parser and cache
├── data/
│   └── VCP - Execution sheet 1.xlsx
├── static/
│   ├── index.html                 Dashboard layout
│   ├── styles.css                 Responsive design
│   └── app.js                     Filters, visualisations and auto-refresh
├── requirements.txt
├── run_dashboard.bat
├── run_dashboard.sh
├── Dockerfile
├── docker-compose.yml
├── preview-desktop.png
└── preview-mobile.png
```

## Troubleshooting

**Dashboard does not update after saving Excel**  
Confirm that `EXCEL_PATH` points to the exact file being edited. The footer and header show the workbook save time currently read by the app. Use **Refresh now** to force an immediate reload.

**A function shows zero key themes**  
That function tab currently has no text in the key-theme cells for the selected year. Placeholder bullet cells alone are not treated as key themes.

**A dependency shows “No update”**  
The dependency action may exist, but its status and completion cells are blank. Enter a status symbol or percentage in the corresponding progress-tracker block and save Excel.

**The server starts but another computer cannot open it**  
Run with `HOST=0.0.0.0`, allow the port through the internal firewall and use the server computer’s network address. Add organisational authentication before broad distribution.
