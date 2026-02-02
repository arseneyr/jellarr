import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveFileReferences } from "../../src/lib/file-refs";
import { promises as fs } from "fs";

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

const mockReadFile = fs.readFile as ReturnType<typeof vi.fn>;

describe("resolveFileReferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve a simple _file reference", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("secret-value\n");
    const input: Record<string, unknown> = {
      ApiKey: { _file: "/run/secrets/api-key" },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({ApiKey: "secret-value"});
    expect(mockReadFile).toHaveBeenCalledWith("/run/secrets/api-key", "utf8");
  });

  it("should pass through plain values unchanged", async () => {
    // Arrange
    const input: Record<string, unknown> = {
      stringValue: "test",
      numberValue: 123,
      booleanValue: true,
      nullValue: null,
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      stringValue: "test",
      numberValue: 123,
      booleanValue: true,
      nullValue: null,
    });
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("should not resolve objects with _file plus extra keys", async () => {
    // Arrange
    const input: Record<string, unknown> = {
      Setting: { _file: "/some/path", extra: "key" },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      Setting: { _file: "/some/path", extra: "key" },
    });
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("should resolve _file references inside nested objects", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("nested-secret\n");
    const input: Record<string, unknown> = {
      Outer: {
        Inner: { _file: "/run/secrets/nested" },
        Plain: "value",
      },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      Outer: { Inner: "nested-secret", Plain: "value" },
    });
  });

  it("should resolve _file references inside arrays", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("array-secret\n");
    const input: Record<string, unknown> = {
      Items: [{ _file: "/run/secrets/item" }, "plain-value"],
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      Items: ["array-secret", "plain-value"],
    });
  });

  it("should resolve multiple _file references", async () => {
    // Arrange
    mockReadFile
      .mockResolvedValueOnce("secret-one\n")
      .mockResolvedValueOnce("secret-two\n");
    const input: Record<string, unknown> = {
      KeyOne: { _file: "/run/secrets/one" },
      KeyTwo: { _file: "/run/secrets/two" },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      KeyOne: "secret-one",
      KeyTwo: "secret-two",
    });
  });

  it("should throw when file cannot be read", async () => {
    // Arrange
    mockReadFile.mockRejectedValueOnce(new Error("ENOENT: no such file"));
    const input: Record<string, unknown> = {
      ApiKey: { _file: "/nonexistent/path" },
    };

    // Act & Assert
    await expect(resolveFileReferences(input)).rejects.toThrow(
      "Failed to read file referenced by _file: /nonexistent/path",
    );
  });

  it("should trim whitespace from file contents", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("  secret-with-whitespace  \n\n");
    const input: Record<string, unknown> = {
      ApiKey: { _file: "/run/secrets/key" },
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({ ApiKey: "secret-with-whitespace" });
  });

  it("should handle mixed inline and _file values", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("file-secret\n");
    const input: Record<string, unknown> = {
      ApiKey: { _file: "/run/secrets/key" },
      NormalSetting: "inline-value",
      NumberSetting: 42,
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      ApiKey: "file-secret",
      NormalSetting: "inline-value",
      NumberSetting: 42,
    });
  });

  it("should resolve _file references inside objects within arrays", async () => {
    // Arrange
    mockReadFile.mockResolvedValueOnce("deep-secret\n");
    const input: Record<string, unknown> = {
      Users: [
        { AccessToken: { _file: "/run/secrets/token" }, Name: "alice" },
        { AccessToken: "inline-token", Name: "bob" },
      ],
    };

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({
      Users: [
        { AccessToken: "deep-secret", Name: "alice" },
        { AccessToken: "inline-token", Name: "bob" },
      ],
    });
    expect(mockReadFile).toHaveBeenCalledWith("/run/secrets/token", "utf8");
  });

  it("should return empty object for empty input", async () => {
    // Arrange
    const input: Record<string, unknown> = {};

    // Act
    const result: Record<string, unknown> = await resolveFileReferences(input);

    // Assert
    expect(result).toStrictEqual({});
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});
