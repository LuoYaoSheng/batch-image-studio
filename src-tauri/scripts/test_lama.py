#!/usr/bin/env python3
"""
测试 LaMa ONNX 模型是否正常工作
"""
import sys
import numpy as np
from PIL import Image
import onnxruntime as ort

def main():
    model_path = "resources/models/lama-v1/model.onnx"

    print("加载模型...")
    session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])

    print(f"模型输入:")
    for inp in session.get_inputs():
        print(f"  {inp.name}: {inp.shape} ({inp.type})")
    print(f"模型输出:")
    for out in session.get_outputs():
        print(f"  {out.name}: {out.shape} ({out.type})")

    # 创建测试图像：512x512 红色背景，中间有白色方块
    image = np.zeros((512, 512, 3), dtype=np.float32)
    image[:, :, 0] = 1.0  # 红色通道
    image[:, :, 1] = 0.0
    image[:, :, 2] = 0.0

    # 创建测试mask：中间200x200区域需要修复
    mask = np.zeros((512, 512), dtype=np.float32)
    mask[156:356, 156:356] = 1.0

    # 保存输入用于对比
    Image.fromarray((image * 255).astype(np.uint8)).save("/tmp/test_input.png")
    Image.fromarray((mask * 255).astype(np.uint8)).save("/tmp/test_mask.png")

    print(f"\n输入图像范围: [{image.min():.3f}, {image.max():.3f}]")
    print(f"输入mask范围: [{mask.min():.3f}, {mask.max():.3f}]")
    print(f"Mask非零像素: {np.count_nonzero(mask)}")

    # 准备输入张量
    image_tensor = image.transpose(2, 0, 1)[np.newaxis, :].astype(np.float32)
    mask_tensor = mask[np.newaxis, np.newaxis, :].astype(np.float32)

    print(f"\nimage_tensor形状: {image_tensor.shape}")
    print(f"mask_tensor形状: {mask_tensor.shape}")

    # 获取输入输出名称
    input_names = [inp.name for inp in session.get_inputs()]
    output_names = [out.name for out in session.get_outputs()]

    print(f"\n使用输入: {input_names}")
    print(f"使用输出: {output_names}")

    # 运行推理
    print("\n运行推理...")
    result = session.run(output_names, {
        input_names[0]: image_tensor,
        input_names[1]: mask_tensor,
    })

    output = result[0]  # [1, 3, 512, 512]
    output_img = output[0].transpose(1, 2, 0)  # [512, 512, 3]

    print(f"输出范围: [{output_img.min():.3f}, {output_img.max():.3f}]")

    # 检查输出类型
    if output_img.min() < 0:
        print("检测到负值！模型可能使用 tanh 激活")
        output_img = (output_img + 1.0) / 2.0
        print(f"转换后范围: [{output_img.min():.3f}, {output_img.max():.3f}]")

    # 保存输出
    if output_img.max() <= 1.0:
        output_uint8 = (output_img * 255).clip(0, 255).astype(np.uint8)
    else:
        output_uint8 = output_img.clip(0, 255).astype(np.uint8)

    Image.fromarray(output_uint8).save("/tmp/test_output.png")
    print("\n已保存:")
    print("  /tmp/test_input.png  - 输入图像")
    print("  /tmp/test_mask.png   - Mask")
    print("  /tmp/test_output.png - 输出图像")

    # 检查输出是否与输入不同
    input_center = image[156:356, 156:356].copy()
    output_center = output_img[156:356, 156:356].copy()
    diff = np.abs(input_center - output_center).mean()
    print(f"\nMask区域平均差异: {diff:.3f}")
    if diff < 0.01:
        print("⚠️ 警告: 输出与输入几乎相同！模型可能没有正常工作")
    else:
        print("✓ 输出与输入有明显差异，模型正常工作")

if __name__ == "__main__":
    main()
