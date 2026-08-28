import ipaddress
import json
import os
import subprocess

import requests


PUBLIC_IP_URL = "https://api.ipify.org"
AZURE_RESOURCE_GROUP = os.getenv(
    "STACKTREND_AZURE_RESOURCE_GROUP",
    "stacktrends-rg",
)
AZURE_POSTGRES_SERVER = os.getenv(
    "STACKTREND_AZURE_POSTGRES_SERVER",
    "stacktrends-db",
)
MANAGED_FIREWALL_RULE = os.getenv(
    "STACKTREND_AZURE_FIREWALL_RULE",
    "StackTrendHomeIP",
)


def _get_current_public_ip():
    response = requests.get(PUBLIC_IP_URL, timeout=10)
    response.raise_for_status()
    current_ip = response.text.strip()
    return str(ipaddress.IPv4Address(current_ip))


def _run_azure_cli(arguments):
    try:
        result = subprocess.run(
            ["az", *arguments],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as error:
        raise RuntimeError("Azure CLI is not installed or is not available in PATH.") from error
    except subprocess.CalledProcessError as error:
        details = (error.stderr or error.stdout or str(error)).strip()
        raise RuntimeError(f"Azure CLI command failed: {details}") from error

    return result.stdout


def _list_firewall_rules():
    output = _run_azure_cli(
        [
            "postgres",
            "flexible-server",
            "firewall-rule",
            "list",
            "--resource-group",
            AZURE_RESOURCE_GROUP,
            "--name",
            AZURE_POSTGRES_SERVER,
            "--output",
            "json",
        ]
    )
    return json.loads(output)


def _find_matching_rule(current_ip, rules):
    address = ipaddress.IPv4Address(current_ip)

    for rule in rules:
        try:
            start = ipaddress.IPv4Address(rule["startIpAddress"])
            end = ipaddress.IPv4Address(rule["endIpAddress"])
        except (KeyError, ipaddress.AddressValueError):
            continue

        if start <= address <= end:
            return rule

    return None


def _trust_current_ip(current_ip, rules):
    managed_rule_exists = any(
        rule.get("name") == MANAGED_FIREWALL_RULE for rule in rules
    )
    action = "update" if managed_rule_exists else "create"

    arguments = [
        "postgres",
        "flexible-server",
        "firewall-rule",
        action,
        "--resource-group",
        AZURE_RESOURCE_GROUP,
        "--name",
        AZURE_POSTGRES_SERVER,
        "--rule-name",
        MANAGED_FIREWALL_RULE,
        "--start-ip-address",
        current_ip,
        "--end-ip-address",
        current_ip,
        "--output",
        "none",
    ]
    _run_azure_cli(arguments)


def ensure_current_ip_allowed():
    """Ensure this machine's public IP is allowed by Azure PostgreSQL."""
    current_ip = _get_current_public_ip()
    print(f"当前公网 IP: {current_ip}")

    rules = _list_firewall_rules()
    matching_rule = _find_matching_rule(current_ip, rules)

    if matching_rule:
        start_ip = matching_rule.get("startIpAddress")
        end_ip = matching_rule.get("endIpAddress")
        print(
            "Azure 已信任该 IP: "
            f"{start_ip} - {end_ip}（规则: {matching_rule.get('name')}）"
        )
        return False

    print("Azure 尚未信任当前公网 IP，正在更新防火墙规则。")
    _trust_current_ip(current_ip, rules)
    print(
        f"Azure 已信任当前公网 IP: {current_ip}（规则: {MANAGED_FIREWALL_RULE}）"
    )
    return True


if __name__ == "__main__":
    ensure_current_ip_allowed()
