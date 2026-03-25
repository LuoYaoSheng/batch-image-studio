#!/usr/bin/env python3
"""
LaMa ONNX Inpainting Script
用于处理图像修复的 Python 脚本
"""

import sys
import json
import argparse
import time
from pathlib import Path

try:
    import onnxruntime as ort
    import numpy as np
    from PIL import Image
except ImportError as e:
    print(json.dumps({"error": f"缺少依赖: {e}. 请安装: pip install onnxruntime numpy pillow"}))
    sys.exit(1)


def load_image(image_path):
    """加载图像"""
    img = Image.open(image_path).convert("RGB")
    return np.array(img).astype(np.float32) / 255.0


def load_mask(mask_path):
    """加载 mask"""
    img = Image.open(mask_path).convert("L")
    mask = np.array(img).astype(np.float32) / 255.0
    return mask


def save_image(img_array, output_path):
    """保存图像"""
    img_array = (img_array * 255).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(img_array)
    img.save(output_path)


def inpaint(model_path, image_path, mask_path, output_path, target_size=(512, 512)):
    """
    使用 LaMa ONNX 模型进行图像修复

    Args:
        model_path: ONNX 模型路径
        image_path: 输入图像路径
        mask_path: mask 图像路径
        output_path: 输出图像路径
        target_size: 目标尺寸 (width, height)
    """
    try:
        t0 = time.time()
        # 加载模型
        session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
        t1 = time.time()
        print(f"[DEBUG] 模型加载耗时: {t1-t0:.2f}秒", file=sys.stderr)

        # 加载图像和 mask
        t2 = time.time()
        image = load_image(image_path)
        mask = load_mask(mask_path)
        t3 = time.time()
        print(f"[DEBUG] 图像加载耗时: {t3-t2:.2f}秒", file=sys.stderr)

        h, w = image.shape[:2]

        # 调整大小到目标尺寸
        t4 = time.time()
        image_resized = np.array(Image.fromarray((image * 255).astype(np.uint8)).resize(target_size, Image.LANCZOS)).astype(np.float32) / 255.0
        mask_resized = np.array(Image.fromarray((mask * 255).astype(np.uint8)).resize(target_size, Image.NEAREST)).astype(np.float32)

        # 确保mask是二值的（0或1）
        mask_resized = (mask_resized > 0.5).astype(np.float32)
        t5 = time.time()
        print(f"[DEBUG] 图像调整耗时: {t5-t4:.2f}秒", file=sys.stderr)

        # 调试信息：原始图像和 mask 的统计信息
        mask_nonzero = np.count_nonzero(mask)
        mask_ratio = mask_nonzero / (h * w)
        print(f"[DEBUG] 原始图像: {w}x{h}, Mask非零像素: {mask_nonzero}/{h*w} ({mask_ratio:.2%})", file=sys.stderr)

        # 调试信息：调整后的统计
        mask_resized_nonzero = np.count_nonzero(mask_resized)
        print(f"[DEBUG] 调整后图像: {target_size}, Mask非零像素: {mask_resized_nonzero}", file=sys.stderr)
        print(f"[DEBUG] image_resized范围: [{image_resized.min():.3f}, {image_resized.max():.3f}]", file=sys.stderr)
        print(f"[DEBUG] mask_resized范围: [{mask_resized.min():.3f}, {mask_resized.max():.3f}]", file=sys.stderr)

        # 准备输入张量 (NCHW 格式)
        # 图像: [1, 3, H, W], 值域 [0, 1]
        image_tensor = image_resized.transpose(2, 0, 1)[np.newaxis, :]
        # Mask: [1, 1, H, W], 值域 {0, 1}
        mask_tensor = mask_resized[np.newaxis, np.newaxis, :]

        # 获取模型输入输出名称
        input_names = [inp.name for inp in session.get_inputs()]
        output_names = [out.name for out in session.get_outputs()]

        print(f"[DEBUG] 输入名称: {input_names}, 输出名称: {output_names}", file=sys.stderr)
        print(f"[DEBUG] image_tensor形状: {image_tensor.shape}, mask_tensor形状: {mask_tensor.shape}", file=sys.stderr)

        # 运行推理
        t6 = time.time()
        inputs = {
            input_names[0]: image_tensor.astype(np.float32),
            input_names[1]: mask_tensor.astype(np.float32),
        }

        result = session.run(output_names, inputs)
        t7 = time.time()
        print(f"[DEBUG] 模型推理耗时: {t7-t6:.2f}秒", file=sys.stderr)
        output = result[0]  # [1, 3, H, W]

        # 转换回图像
        t8 = time.time()
        output_img = output[0].transpose(1, 2, 0)  # [H, W, 3]

        print(f"[DEBUG] 模型输出范围: [{output_img.min():.3f}, {output_img.max():.3f}]", file=sys.stderr)

        # Carve/LaMa-ONNX 模型输出直接在 [0, 255] 范围
        # 检查输出值范围并调整
        if output_img.max() <= 1.0 and output_img.min() >= 0:
            # 标准的 [0, 1] 范围输出
            output_img = (output_img * 255).clip(0, 255)
            print(f"[DEBUG] 检测到 [0, 1] 范围输出，乘以255", file=sys.stderr)
        elif output_img.min() < 0:
            # tanh 激活输出 [-1, 1]
            output_img = ((output_img + 1.0) / 2.0 * 255).clip(0, 255)
            print(f"[DEBUG] 检测到负值，应用tanh转换", file=sys.stderr)
        else:
            # 已经在 [0, 255] 范围
            output_img = output_img.clip(0, 255)
            print(f"[DEBUG] 检测到 [0, 255] 范围输出", file=sys.stderr)

        print(f"[DEBUG] 最终输出范围: [{output_img.min():.1f}, {output_img.max():.1f}]", file=sys.stderr)

        # 调整回原始大小
        output_img = Image.fromarray(output_img.astype(np.uint8))
        output_img = output_img.resize((w, h), Image.LANCZOS)

        # 保存结果
        output_img.save(output_path)
        t9 = time.time()
        print(f"[DEBUG] 输出处理耗时: {t9-t8:.2f}秒", file=sys.stderr)
        print(f"[DEBUG] 总耗时: {t9-t0:.2f}秒", file=sys.stderr)

        return True, None

    except Exception as e:
        import traceback
        print(f"[ERROR] {str(e)}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return False, str(e)


def main():
    parser = argparse.ArgumentParser(description="LaMa ONNX Inpainting")
    parser.add_argument("--model", required=True, help="ONNX 模型路径")
    parser.add_argument("--image", required=True, help="输入图像路径")
    parser.add_argument("--mask", required=True, help="Mask 图像路径")
    parser.add_argument("--output", required=True, help="输出图像路径")
    parser.add_argument("--size", type=int, nargs=2, default=[512, 512], help="目标尺寸 (宽 高)")

    args = parser.parse_args()

    success, error = inpaint(
        args.model,
        args.image,
        args.mask,
        args.output,
        tuple(args.size)
    )

    if success:
        print(json.dumps({"success": True, "output": args.output}))
    else:
        print(json.dumps({"success": False, "error": error}))
        sys.exit(1)


if __name__ == "__main__":
    main()
