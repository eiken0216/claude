#!/bin/bash
cd "$(dirname "$0")/.."
node scripts/trends_geo.mjs "/g/11xw90cy21" "PPPP_12m"          "today 12-m"   ; sleep 25
node scripts/trends_geo.mjs "/g/11ybgh__53" "LEMONMELONCOOKIE_12m" "today 12-m"; sleep 25
node scripts/trends_geo.mjs "/g/11xw90cy21" "PPPP_5y"           "today 5-y"    ; sleep 25
node scripts/trends_geo.mjs "/g/11xw90cy21" "PPPP_90d"          "today 3-m"
echo TRENDS_DONE
