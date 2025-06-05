# Educrafters

This repository contains an example **AI-Powered Webinar Participant Analyzer Dashboard**.

The dashboard is built with [Streamlit](https://streamlit.io/) and uses **pandas** for data processing and **Plotly** for visualization. It also includes placeholder functions for additional analysis that could be generated automatically with Codex or similar tools. Optionally, the dashboard can connect to the Google Sheets API to load participant data from a spreadsheet.

## Requirements

Install the required dependencies using pip:

```bash
pip install -r requirements.txt
```

## Running the Dashboard

Use the following command to start the Streamlit application:

```bash
streamlit run webinar_analyzer/dashboard.py
```

Upload a CSV file containing webinar participant data. If the file contains a `duration` column, a histogram of participant durations will be displayed. Summary statistics for all columns are also shown.

## Google Sheets Integration (Optional)

To load data from Google Sheets, set up OAuth credentials and modify the placeholder section in `dashboard.py` to authorize access with `gspread`.
