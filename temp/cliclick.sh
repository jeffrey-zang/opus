#!/bin/bash

sleep 5
# Define center
centerX=735
centerY=478

# Head (circle)
cliclick "m:$centerX,$centerY" "dd:$centerX,$centerY"
for angle in {0..360..10}; do
	x=$(echo "$centerX + 100 * c($angle * 0.0174533)" | bc -l)
	y=$(echo "$centerY + 100 * s($angle * 0.0174533)" | bc -l)
	cliclick "m:${x%.*},${y%.*}"
done
cliclick "du:$centerX,$centerY"

# Left eye
eyeOffsetX=30
eyeOffsetY=30
leftEyeX=$((centerX - eyeOffsetX))
leftEyeY=$((centerY - eyeOffsetY))

cliclick "m:$leftEyeX,$leftEyeY" "dd:$leftEyeX,$leftEyeY"
for angle in {0..360..15}; do
	x=$(echo "$leftEyeX + 10 * c($angle * 0.0174533)" | bc -l)
	y=$(echo "$leftEyeY + 10 * s($angle * 0.0174533)" | bc -l)
	cliclick "m:${x%.*},${y%.*}"
done
cliclick "du:$leftEyeX,$leftEyeY"

# Right eye
rightEyeX=$((centerX + eyeOffsetX))
rightEyeY=$leftEyeY

cliclick "m:$rightEyeX,$rightEyeY" "dd:$rightEyeX,$rightEyeY"
for angle in {0..360..15}; do
	x=$(echo "$rightEyeX + 10 * c($angle * 0.0174533)" | bc -l)
	y=$(echo "$rightEyeY + 10 * s($angle * 0.0174533)" | bc -l)
	cliclick "m:${x%.*},${y%.*}"
done
cliclick "du:$rightEyeX,$rightEyeY"

# Smile (arc from ~200° to ~340°)
cliclick "m:$((centerX - 50)),$((centerY + 50))" "dd:$((centerX - 50)),$((centerY + 50))"
for angle in {200..340..10}; do
	x=$(echo "$centerX + 50 * c($angle * 0.0174533)" | bc -l)
	y=$(echo "$centerY + 30 * s($angle * 0.0174533)" | bc -l)
	cliclick "m:${x%.*},${y%.*}"
done
cliclick "du:$((centerX + 50)),$((centerY + 50))"
