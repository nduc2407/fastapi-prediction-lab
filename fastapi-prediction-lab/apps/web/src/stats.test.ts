import { describe, expect, it } from "vitest";
import { classifyConcurrency, formatMs, median, speedup } from "./stats";

describe("median", () => {
  it("lẻ và chẵn phần tử", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("rỗng trả NaN", () => {
    expect(median([])).toBeNaN();
  });
  it("không làm thay đổi mảng gốc", () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("speedup", () => {
  it("tính tỉ lệ", () => {
    expect(speedup(20, 2)).toBe(10);
  });
  it("chia cho 0 hoặc giá trị không hợp lệ trả NaN", () => {
    expect(speedup(20, 0)).toBeNaN();
    expect(speedup(NaN, 2)).toBeNaN();
  });
});

describe("classifyConcurrency", () => {
  it("xếp hàng: 3 request x 2s mất ~6s", () => {
    expect(classifyConcurrency(6.05, 3, 2)).toBe("sequential");
  });
  it("song song: 3 request x 2s mất ~2s", () => {
    expect(classifyConcurrency(2.05, 3, 2)).toBe("parallel");
  });
  it("giữa hai mức", () => {
    expect(classifyConcurrency(4, 3, 2)).toBe("mixed");
  });
  it("một request luôn là song song", () => {
    expect(classifyConcurrency(2, 1, 2)).toBe("parallel");
  });
});

describe("formatMs", () => {
  it("định dạng và xử lý NaN", () => {
    expect(formatMs(1.234)).toBe("1.23 ms");
    expect(formatMs(12.34)).toBe("12.3 ms");
    expect(formatMs(NaN)).toBe("–");
  });
});
