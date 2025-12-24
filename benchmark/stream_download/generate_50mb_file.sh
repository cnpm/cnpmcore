#!/bin/bash

# 生成一个50MB的txt文件，内容都是1
# 文件名为: 50mb_ones.txt

OUTPUT_FILE="50mb_ones.txt"
TARGET_SIZE_MB=50
TARGET_SIZE_BYTES=$((TARGET_SIZE_MB * 1024 * 1024))

# 检查文件是否已存在
if [ -f "$OUTPUT_FILE" ]; then
    echo "文件 $OUTPUT_FILE 已存在，正在删除..."
    rm -f "$OUTPUT_FILE"
fi

echo "正在生成 $TARGET_SIZE_MB MB 的文件，内容都是1..."

# 使用dd命令生成文件，每块1KB，共50*1024块
dd if=/dev/zero bs=1024 count=$((TARGET_SIZE_MB * 1024)) | tr '\0' '1' > "$OUTPUT_FILE"

# 验证文件大小
ACTUAL_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
if [ "$ACTUAL_SIZE" -eq "$TARGET_SIZE_BYTES" ]; then
    echo "成功生成文件: $OUTPUT_FILE"
    echo "文件大小: $(ls -lh "$OUTPUT_FILE" | awk '{print $5}')"
else
    echo "警告: 文件大小不匹配，期望: $TARGET_SIZE_BYTES 字节，实际: $ACTUAL_SIZE 字节"
fi

echo "文件路径: $(pwd)/$OUTPUT_FILE"