import streamlit as st
import pandas as pd
import plotly.express as px
from .analysis import participant_summary


def load_data(uploaded_file):
    if uploaded_file is not None:
        return pd.read_csv(uploaded_file)
    return pd.DataFrame()


def main():
    st.title("AI-Powered Webinar Participant Analyzer")

    uploaded_file = st.file_uploader("Upload participant CSV", type="csv")
    df = load_data(uploaded_file)

    if not df.empty:
        st.subheader("Raw Data")
        st.dataframe(df)

        st.subheader("Summary Statistics")
        summary = participant_summary(df)
        st.write(summary)

        if 'duration' in df.columns:
            fig = px.histogram(df, x='duration', nbins=20, title='Participant Duration')
            st.plotly_chart(fig, use_container_width=True)

    # Placeholder: connect to Google Sheets API if credentials are provided
    # and allow pulling data directly from a spreadsheet.

if __name__ == "__main__":
    main()
