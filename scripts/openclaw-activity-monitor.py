#!/usr/bin/env python3
import json
import shutil
import subprocess
import sys
import time
from datetime import datetime


def run_json(cmd):
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, text=True)
        return json.loads(out)
    except Exception:
        return None


def truncate(text, width):
    text = '' if text is None else str(text)
    return text if len(text) <= width else text[: max(0, width - 1)] + '…'


def collect_session_activity(active_minutes=30, limit=8, agent_filter=None):
    cmd = ['openclaw', 'sessions', '--all-agents', '--json', '--active', str(active_minutes)]
    base = run_json(cmd) or {}
    rows = []
    for session in base.get('sessions', []):
        agent = session.get('agentId', '?')
        if agent_filter and agent != agent_filter:
            continue
        key = session.get('key', '')
        updated = session.get('updatedAt') or session.get('lastUpdatedAt') or ''
        model = session.get('model', '')
        rows.append({
            'agent': agent,
            'updated': updated,
            'model': model,
            'key': key,
        })
    rows.sort(key=lambda r: (r['updated'] or ''), reverse=True)
    return rows[:limit]


def collect_tasks(limit=6, agent_filter=None):
    data = run_json(['openclaw', 'tasks', 'list', '--json']) or {}
    items = data.get('tasks') or data.get('runs') or []
    rows = []
    for item in items:
        agent = item.get('agentId') or ''
        if agent_filter and agent != agent_filter:
            continue
        rows.append({
            'runtime': item.get('runtime') or item.get('kind') or '',
            'status': item.get('status') or '',
            'agent': agent,
            'title': item.get('title') or item.get('task') or item.get('label') or '',
        })
    return rows[:limit]


def collect_recent_logs(limit=8, grep_text=None):
    try:
        out = subprocess.check_output(['openclaw', 'logs', '--json', '--limit', str(limit * 4)], text=True)
    except Exception:
        return []
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        msg = obj.get('msg') or obj.get('message') or ''
        if grep_text and grep_text.lower() not in msg.lower():
            continue
        rows.append({
            'ts': obj.get('time') or obj.get('timestamp') or '',
            'level': obj.get('level') or '',
            'msg': msg,
        })
    return rows[-limit:]


def print_table(title, headers, rows, widths):
    print(title)
    print(' | '.join(h.ljust(w) for h, w in zip(headers, widths)))
    print('-+-'.join('-' * w for w in widths))
    if not rows:
        print('(none)')
        print()
        return
    for row in rows:
        print(' | '.join(truncate(col, w).ljust(w) for col, w in zip(row, widths)))
    print()


def render_once(interval, active_minutes, agent_filter, grep_text):
    cols = shutil.get_terminal_size((100, 40)).columns
    compact = cols < 120
    print('\033[2J\033[H', end='')
    title = 'OpenClaw Activity'
    if agent_filter:
        title += f' [{agent_filter}]'
    print(f'{title} | {datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")} | refresh {interval}s')
    print()

    sessions = collect_session_activity(active_minutes=active_minutes, limit=6 if compact else 8, agent_filter=agent_filter)
    if compact:
        session_rows = [[r['agent'], r['updated'], r['key']] for r in sessions]
        print_table('ACTIVE SESSIONS', ['AGENT', 'UPDATED', 'SESSION_KEY'], session_rows, [12, 12, max(20, cols - 30)])
    else:
        session_rows = [[r['agent'], r['updated'], r['model'], r['key']] for r in sessions]
        print_table('ACTIVE SESSIONS', ['AGENT', 'UPDATED', 'MODEL', 'SESSION_KEY'], session_rows, [12, 20, 12, max(20, cols - 50)])

    tasks = collect_tasks(limit=5, agent_filter=agent_filter)
    if compact:
        task_rows = [[r['status'], r['agent'], r['title']] for r in tasks]
        print_table('TASKS', ['STATUS', 'AGENT', 'TITLE'], task_rows, [12, 12, max(20, cols - 30)])
    else:
        task_rows = [[r['runtime'], r['status'], r['agent'], r['title']] for r in tasks]
        print_table('TASKS', ['RUNTIME', 'STATUS', 'AGENT', 'TITLE'], task_rows, [10, 12, 12, max(20, cols - 40)])

    logs = collect_recent_logs(limit=6 if compact else 8, grep_text=grep_text)
    log_rows = [[r['ts'], r['level'], r['msg']] for r in logs]
    print_table('RECENT LOGS', ['TIME', 'LEVEL', 'MESSAGE'], log_rows, [20, 8, max(20, cols - 32)])


def main():
    interval = 2.0
    active_minutes = 30
    agent_filter = None
    grep_text = None

    args = sys.argv[1:]
    for arg in args:
        if arg.replace('.', '', 1).isdigit():
            interval = float(arg)
        elif arg.startswith('--minutes='):
            active_minutes = int(arg.split('=', 1)[1])
        elif arg.startswith('--agent='):
            agent_filter = arg.split('=', 1)[1]
        elif arg.startswith('--grep='):
            grep_text = arg.split('=', 1)[1]

    while True:
        render_once(interval, active_minutes, agent_filter, grep_text)
        time.sleep(interval)


if __name__ == '__main__':
    main()
