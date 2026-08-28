from python_scraper.add_YOE_labels import (
    count_junior_jobs,
    update_year_of_experience_and_job_level,
)
from python_scraper.get_raw_jobs_data import count_jobs_by_month, get_jobs_data
from python_scraper.add_tech_stack_labels import add_tech_stack_labels
from python_scraper.create_tech_stack_rank import create_tech_stack_rank
from python_scraper.create_tech_stack_rank import create_tech_stack_rank_by_company
from python_scraper.create_tech_stack_rank import update_landing_summary
from python_scraper.create_tech_stack_rank import get_top_growing_and_declining_techs
from python_scraper.azure_firewall import ensure_current_ip_allowed

def main():
    ensure_current_ip_allowed()
    new_job_ids = get_jobs_data()
    count_jobs_by_month()
    update_year_of_experience_and_job_level()
    add_tech_stack_labels()
    create_tech_stack_rank()
    create_tech_stack_rank_by_company()
    update_landing_summary()
    # get_top_growing_and_declining_techs()

    junior_job_count = count_junior_jobs(new_job_ids)
    print(f"本次新增的 Junior jobs 数量: {junior_job_count}")
    print(1 if junior_job_count > 0 else 0)


if __name__ == "__main__":
    main()
