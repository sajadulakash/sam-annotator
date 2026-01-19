# Sample Output - YOLO Segmentation Format

This document shows example annotation outputs in YOLO segmentation format.

## Format Specification

Each line in the `.txt` file represents one object:
```
class_id x1 y1 x2 y2 x3 y3 ... xn yn
```

Where:
- `class_id`: Integer class index (0-based)
- `x1 y1 ... xn yn`: Normalized polygon coordinates (0.0 to 1.0)

## Example: `image001.txt`

```
0 0.123456 0.234567 0.345678 0.456789 0.234567 0.567890 0.123456 0.456789 0.112345 0.345678
1 0.654321 0.123456 0.765432 0.234567 0.876543 0.345678 0.765432 0.456789 0.654321 0.345678 0.543210 0.234567
```

### Breakdown:

**Object 1 (class 0 - e.g., "person")**
- Class ID: 0
- Polygon vertices (normalized):
  - (0.123456, 0.234567)
  - (0.345678, 0.456789)
  - (0.234567, 0.567890)
  - (0.123456, 0.456789)
  - (0.112345, 0.345678)

**Object 2 (class 1 - e.g., "car")**
- Class ID: 1
- Polygon vertices (normalized):
  - (0.654321, 0.123456)
  - (0.765432, 0.234567)
  - (0.876543, 0.345678)
  - (0.765432, 0.456789)
  - (0.654321, 0.345678)
  - (0.543210, 0.234567)

## Converting to Absolute Coordinates

To convert normalized coordinates to pixel coordinates:
```python
# Given: image_width = 1920, image_height = 1080
# Normalized point: (0.5, 0.5)
# Absolute point: (0.5 * 1920, 0.5 * 1080) = (960, 540)

def denormalize(points, width, height):
    return [(x * width, y * height) for x, y in points]
```

## classes.txt (Optional)

You can also create a `classes.txt` file listing class names:
```
person
car
bicycle
dog
```

The line number (0-indexed) corresponds to the class_id in annotations.

## Directory Structure

```
dataset/
├── images/
│   ├── image001.jpg
│   ├── image002.jpg
│   └── ...
├── labels/
│   ├── image001.txt
│   ├── image002.txt
│   └── ...
└── classes.txt
```
