import azure.functions as func
import datetime
import json
import logging
from python_scraper.get_raw_jobs_data import get_jobs_data
from python_scraper.add_tech_stack_labels import add_tech_stack_labels
from python_scraper.create_tech_stack_rank import create_tech_stack_rank
import traceback

app = func.FunctionApp()

@app.schedule(schedule="0 0 0 * * 1-5", arg_name="mytimer", run_on_startup=False, use_monitor=True)
def ScheduledScraper(mytimer: func.TimerRequest) -> None:
    logging.info(f"⏰ Timer triggered at {datetime.datetime.utcnow()}")

    try:
        get_jobs_data()
        add_tech_stack_labels()
        create_tech_stack_rank()
        logging.info("✅ All tasks completed successfully.")
    except Exception as e:
        logging.error(f"❌ Error occurred: {e}")
        logging.error(traceback.format_exc()) 