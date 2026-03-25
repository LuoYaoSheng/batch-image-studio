#!/usr/bin/env python3
"""
LaMa ONNX 长驻留服务
一次性加载模型，通过stdin/stdout处理多张图片
"""

import sys
import json
import time
import argparse
from pathlib import Path

try:
    import onnxruntime as ort
    import numpy as np
    from PIL import Image
except ImportError as e:
    print(json.dumps({"error": f"缺少依赖: {e}"}))
    sys.exit(1)


class LamaService:
    def __init__(self, model_path):
        """初始化服务，加载模型"""
        self.model_path = model_path
        self.session = None
        self.input_names = None
        self.output_names = None
        self._load_model()

    def _load_model(self):
        """加载ONNX模型（只执行一次）"""
        t0 = time.time()
        self.session = ort.InferenceSession(self.model_path, providers=['CPUExecutionProvider'])
        self.input_names = [inp.name for inp in self.session.get_inputs()]
        self.output_names = [out.name for out in self.session.get_outputs()]
        t1 = time.time()
        print(f"[LaMa Server] 模型加载完成，耗时: {t1-t0:.2f}秒", file=sys.stderr, flush=True)

    def inpaint(self, image_path, mask_path, output_path, target_size=(512, 512)):
        """执行图像修复"""
        try:
            # 加载图像和 mask
            image = np.array(Image.open(image_path).convert("RGB")).astype(np.float32) / 255.0
            mask = np.array(Image.open(mask_path).convert("L")).astype(np.float32) / 255.0

            h, w = image.shape[:2]

            # 调整大小到目标尺寸
            image_resized = np.array(Image.fromarray((image * 255).astype(np.uint8)).resize(target_size, Image.LANCZOS)).astype(np.float32) / 255.0
            mask_resized = np.array(Image.fromarray((mask * 255).astype(np.uint8)).resize(target_size, Image.NEAREST)).astype(np.float32)
            mask_resized = (mask_resized > 0.5).astype(np.float32)

            # 准备输入张量 (NCHW 格式)
            image_tensor = image_resized.transpose(2, 0, 1)[np.newaxis, :]
            mask_tensor = mask_resized[np.newaxis, np.newaxis, :]

            # 运行推理
            result = self.session.run(self.output_names, {
                self.input_names[0]: image_tensor.astype(np.float32),
                self.input_names[1]: mask_tensor.astype(np.float32),
            })

            output = result[0][0].transpose(1, 2, 0)  # [H, W, 3]

            # 转换回图像
            if output.max() <= 1.0 and output.min() >= 0:
                output = (output * 255).clip(0, 255)
            elif output.min() < 0:
                output = ((output + 1.0) / 2.0 * 255).clip(0, 255)
            else:
                output = output.clip(0, 255)

            # 调整回原始大小并保存
            output_img = Image.fromarray(output.astype(np.uint8))
            output_img = output_img.resize((w, h), Image.LANCZOS)
            output_img.save(output_path)

            return True, None

        except Exception as e:
            import traceback
            return False, traceback.format_exc()

    def run(self):
        """主循环：从stdin读取请求，处理结果到stdout"""
        print("[LaMa Server] 服务已启动，等待请求...", file=sys.stderr, flush=True)

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
                cmd = request.get("cmd")

                if cmd == "inpaint":
                    success, error = self.inpaint(
                        request["image"],
                        request["mask"],
                        request["output"],
                        tuple(request.get("size", [512, 512]))
                    )
                    if success:
                        print(json.dumps({"success": True}), flush=True)
                    else:
                        print(json.dumps({"success": False, "error": error}), flush=True)

                elif cmd == "quit":
                    print(json.dumps({"success": True}), flush=True)
                    break

                else:
                    print(json.dumps({"success": False, "error": f"未知命令: {cmd}"}), flush=True)

            except Exception as e:
                print(json.dumps({"success": False, "error": str(e)}), flush=True)


def main():
    parser = argparse.ArgumentParser(description="LaMa ONNX Server")
    parser.add_argument("--model", required=True, help="ONNX 模型路径")
    args = parser.parse_args()

    service = LamaService(args.model)
    service.run()


if __name__ == "__main__":
    main()
