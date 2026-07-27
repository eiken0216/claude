#!/bin/bash
# 全MVについて top / new 両方のコメントを収集する（3並列）
cd "$(dirname "$0")/.."
mkdir -p data/raw logs
run() {
  id=$1; name=$2; order=$3; n=$4
  node scripts/yt_fetch.mjs "$id" "$n" "data/raw/${name}_${order}.json" "$order" >> "logs/${name}_${order}.log" 2>&1
  echo "done ${name}_${order}"
}
export -f run
while IFS=$'\t' read -r id name; do
  echo "$id $name top 1000"
  echo "$id $name new 600"
done < scripts/videos.tsv | xargs -P 3 -L 1 bash -c 'run $0 $1 $2 $3'
echo "ALL DONE"
