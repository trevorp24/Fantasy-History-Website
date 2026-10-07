import json
import math
import os
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "snapshots" / "2026" / "moggate_2026_2026-10-06.json"
OUTPUT_DIR = ROOT / "outputs" / "draft-board-points"
CACHE_DATA = OUTPUT_DIR / "draft-board-points-data.json"
LEAGUE_ID = 69640845
SEASON = 2026

POSITION_BY_ID = {
    1: "QB",
    2: "RB",
    3: "WR",
    4: "TE",
    5: "K",
    16: "D/ST",
}

LINEUP_SLOT_BY_ID = {
    0: "QB",
    2: "RB",
    4: "WR",
    6: "TE",
    16: "D/ST",
    17: "K",
}


def read_env():
    env = {}
    env_file = ROOT / ".env.local"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8-sig").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip()
    return env


def fetch_players(player_ids):
    env = read_env()
    swid = env.get("ESPN_SWID")
    espn_s2 = env.get("ESPN_S2")
    if not swid or not espn_s2:
        raise RuntimeError("Missing ESPN_SWID or ESPN_S2 in .env.local.")

    players = {}
    url = (
        f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{SEASON}"
        f"/segments/0/leagues/{LEAGUE_ID}?view=kona_player_info"
    )
    for start in range(0, len(player_ids), 50):
        batch = player_ids[start : start + 50]
        fantasy_filter = {"players": {"filterIds": {"value": batch}}}
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "Cookie": f"SWID={swid}; espn_s2={espn_s2}",
                "User-Agent": "Mozilla/5.0",
                "x-fantasy-filter": json.dumps(fantasy_filter),
            },
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
        for entry in data.get("players", []):
            player = entry.get("player") or {}
            players[entry.get("id") or player.get("id")] = player
    return players


def season_stat(player):
    for stat in player.get("stats") or []:
        if (
            stat.get("seasonId") == SEASON
            and stat.get("scoringPeriodId") == 0
            and stat.get("statSourceId") == 0
            and stat.get("statSplitTypeId") == 0
        ):
            return stat
    return {}


def collect_players(snapshot):
    players = {}
    for entry in snapshot.get("players") or []:
        player = entry.get("player") or {}
        players[entry.get("id") or player.get("id")] = player
    for team in snapshot.get("teams") or []:
        for entry in (team.get("roster") or {}).get("entries") or []:
            pool = entry.get("playerPoolEntry") or {}
            player = pool.get("player") or {}
            players[entry.get("playerId") or player.get("id")] = player
    return players


def collect_playerbase():
    playerbase_file = ROOT / "data" / "playerbase" / "espn-players.json"
    if not playerbase_file.exists():
        return {}
    data = json.loads(playerbase_file.read_text(encoding="utf-8"))
    return {int(player_id): player for player_id, player in (data.get("players") or {}).items()}


def color_for(value, low, high):
    if value is None or high <= low:
        return (180, 186, 196)
    t = max(0, min(1, (value - low) / (high - low)))
    stops = [
        (0.0, (214, 67, 78)),
        (0.45, (245, 174, 86)),
        (0.68, (244, 224, 116)),
        (1.0, (65, 175, 111)),
    ]
    for (left_t, left), (right_t, right) in zip(stops, stops[1:]):
        if t <= right_t:
            local = (t - left_t) / (right_t - left_t)
            return tuple(round(left[i] + (right[i] - left[i]) * local) for i in range(3))
    return stops[-1][1]


def readable_text_color(rgb):
    r, g, b = rgb
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return (17, 24, 39) if luminance > 0.58 else (255, 255, 255)


def font(size, bold=False):
    candidates = [
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def text_width(draw, text, text_font):
    bbox = draw.textbbox((0, 0), text, font=text_font)
    return bbox[2] - bbox[0]


def ellipsize(draw, text, text_font, max_width):
    if text_width(draw, text, text_font) <= max_width:
        return text
    suffix = "..."
    available = max_width - text_width(draw, suffix, text_font)
    out = ""
    for char in text:
        if text_width(draw, out + char, text_font) > available:
            break
        out += char
    return out.rstrip() + suffix


def split_name(draw, name, text_font, max_width):
    parts = name.split()
    if len(parts) <= 1:
        return [ellipsize(draw, name, text_font, max_width)]
    first = parts[0]
    last = " ".join(parts[1:])
    if text_width(draw, name, text_font) <= max_width:
        return [name]
    if text_width(draw, first, text_font) <= max_width and text_width(draw, last, text_font) <= max_width:
        return [first, last]
    return [ellipsize(draw, name, text_font, max_width)]


def lighten(rgb, amount=0.72):
    return tuple(round(channel + (255 - channel) * amount) for channel in rgb)


def draw_tile(draw, box, pick, value, color):
    x1, y1, x2, y2 = box
    fill = lighten(color)
    border = color
    ink = (18, 24, 38)
    muted = (75, 85, 99)
    draw.rounded_rectangle(box, radius=10, fill=fill, outline=border, width=3)

    pad = 10
    top_font = font(15, True)
    name_font = font(16, True)
    meta_font = font(14, True)
    value_font = font(22, True)

    value_text = "--" if value is None else f"{value:.1f}"
    value_bbox = draw.textbbox((0, 0), value_text, font=value_font)
    value_w = value_bbox[2] - value_bbox[0]
    badge = (x2 - value_w - 24, y1 + 9, x2 - 8, y1 + 40)
    draw.rounded_rectangle(badge, radius=7, fill=(255, 255, 255), outline=(209, 213, 219), width=1)
    draw.text((badge[2] - value_w - 8, y1 + 9), value_text, fill=ink, font=value_font)

    pick_text = f"{pick['round']}.{pick['round_pick']:02d}"
    draw.text((x1 + pad, y1 + 10), pick_text, fill=muted, font=top_font)

    max_name_width = x2 - x1 - 2 * pad
    name_lines = split_name(draw, pick["name"], name_font, max_name_width)
    name_y = y1 + 46 if len(name_lines) == 1 else y1 + 36
    for line in name_lines[:2]:
        draw.text((x1 + pad, name_y), line, fill=ink, font=name_font)
        name_y += 18

    meta = pick["position"]
    draw.text((x1 + pad, y2 - 23), meta, fill=muted, font=meta_font)


def render_board(picks, teams, metric, path):
    margin_x = 42
    top = 132
    header_h = 86
    tile_w = 152
    tile_h = 90
    gap = 8
    cols = 14
    rows = 15
    width = margin_x * 2 + cols * tile_w + (cols - 1) * gap
    height = top + header_h + rows * tile_h + (rows - 1) * gap + 72
    image = Image.new("RGB", (width, height), (248, 250, 252))
    draw = ImageDraw.Draw(image)

    values_by_position = {}
    for pick in picks:
        value = pick.get(metric)
        if value is not None:
            values_by_position.setdefault(pick["position"], []).append(value)

    ranges = {}
    for position, values in values_by_position.items():
        values = sorted(values)
        ranges[position] = (values[0], values[-1])

    title = "Total Points" if metric == "total" else "Points Per Game"
    title_font = font(40, True)
    subtitle_font = font(21, False)
    draw.text((margin_x, 34), title, fill=(15, 23, 42), font=title_font)
    draw.text((margin_x, 83), "Half PPR, 4-point passing TDs. Color tiers compare players only within the same position.", fill=(71, 85, 105), font=subtitle_font)

    legend_x = width - 560
    legend_y = 48
    legend_font = font(15, True)
    legend = [("Low", (214, 67, 78)), ("Mid", (245, 174, 86)), ("Strong", (244, 224, 116)), ("Elite", (65, 175, 111))]
    for i, (label, color) in enumerate(legend):
        x = legend_x + i * 132
        draw.rounded_rectangle((x, legend_y, x + 28, legend_y + 18), radius=5, fill=lighten(color, 0.35), outline=color, width=2)
        draw.text((x + 36, legend_y - 1), label, fill=(51, 65, 85), font=legend_font)

    first_round = sorted([pick for pick in picks if pick["round"] == 1], key=lambda item: item["round_pick"])
    team_font = font(14, True)
    pick_font = font(12, True)
    for col, pick in enumerate(first_round):
        x = margin_x + col * (tile_w + gap)
        team_name = teams.get(pick.get("team_id"), f"Team {pick.get('team_id')}")
        team_name = ellipsize(draw, team_name, team_font, tile_w - 10)
        draw.rounded_rectangle((x, top, x + tile_w, top + 58), radius=10, fill=(255, 255, 255), outline=(226, 232, 240), width=1)
        draw.text((x + 8, top + 11), team_name, fill=(15, 23, 42), font=team_font)
        draw.text((x + 8, top + 34), f"Slot {pick['round_pick']}", fill=(100, 116, 139), font=pick_font)

    board_y = top + header_h

    for pick in picks:
        round_idx = pick["round"] - 1
        col = pick["round_pick"] - 1
        if pick["round"] % 2 == 0:
            col = 14 - pick["round_pick"]
        x1 = margin_x + col * (tile_w + gap)
        y1 = board_y + round_idx * (tile_h + gap)
        box = (x1, y1, x1 + tile_w, y1 + tile_h)
        low, high = ranges.get(pick["position"], (0, 0))
        color = color_for(pick.get(metric), low, high)
        draw_tile(draw, box, pick, pick.get(metric), color)

    footer_font = font(14, False)
    draw.text((margin_x, height - 42), "Data source: ESPN league export from October 6, 2026. RBs are colored vs RBs, WRs vs WRs, QBs vs QBs, and so on.", fill=(100, 116, 139), font=footer_font)
    image.save(path, quality=95)


def main():
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    draft_picks = sorted(snapshot["draftDetail"]["picks"], key=lambda p: p["overallPickNumber"])
    teams = {team.get("id"): team.get("name", f"Team {team.get('id')}") for team in snapshot.get("teams", [])}
    player_ids = [pick["playerId"] for pick in draft_picks]
    players = collect_players(snapshot)
    playerbase = collect_playerbase()
    cached = {}
    if CACHE_DATA.exists():
        for record in json.loads(CACHE_DATA.read_text(encoding="utf-8")):
            cached[record.get("player_id")] = record
    missing_ids = [
        player_id
        for player_id in player_ids
        if (player_id not in players or not season_stat(players[player_id])) and player_id not in cached
    ]
    if missing_ids:
        players.update(fetch_players(missing_ids))

    picks = []
    missing_scores = []
    for pick in draft_picks:
        player = players.get(pick["playerId"], {})
        stat = season_stat(player)
        total = stat.get("appliedTotal")
        average = stat.get("appliedAverage")
        position = POSITION_BY_ID.get(player.get("defaultPositionId"), LINEUP_SLOT_BY_ID.get(pick.get("lineupSlotId"), "UNK"))
        cached_record = cached.get(pick["playerId"], {})
        if total is None:
            total = cached_record.get("total")
        if average is None:
            average = cached_record.get("ppg")
        if position == "UNK" and cached_record.get("position"):
            position = cached_record["position"]
        base_record = playerbase.get(pick["playerId"], {})
        cached_name = cached_record.get("name")
        if isinstance(cached_name, str) and cached_name.startswith("Player "):
            cached_name = None
        name = player.get("fullName") or base_record.get("name") or cached_name or f"Player {pick['playerId']}"
        if position == "UNK" and base_record.get("position"):
            position = base_record["position"]
        record = {
            "overall": pick["overallPickNumber"],
            "round": pick["roundId"],
            "round_pick": pick["roundPickNumber"],
            "team_id": pick.get("teamId"),
            "player_id": pick["playerId"],
            "name": name,
            "position": position,
            "total": round(total, 2) if isinstance(total, (int, float)) else None,
            "ppg": round(average, 2) if isinstance(average, (int, float)) else None,
        }
        if record["total"] is None:
            missing_scores.append(record)
        picks.append(record)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "draft-board-points-data.json").write_text(json.dumps(picks, indent=2), encoding="utf-8")
    if missing_scores:
        (OUTPUT_DIR / "missing-scores.json").write_text(json.dumps(missing_scores, indent=2), encoding="utf-8")

    render_board(picks, teams, "total", OUTPUT_DIR / "draft-board-total-points.png")
    render_board(picks, teams, "ppg", OUTPUT_DIR / "draft-board-points-per-game.png")
    print(f"Wrote {OUTPUT_DIR / 'draft-board-total-points.png'}")
    print(f"Wrote {OUTPUT_DIR / 'draft-board-points-per-game.png'}")
    print(f"Wrote {OUTPUT_DIR / 'draft-board-points-data.json'}")
    print(f"Missing scores: {len(missing_scores)}")


if __name__ == "__main__":
    main()
