/**
 * ブラウザ環境差異を吸収するための追加型宣言。
 *
 * 現在は File System Access API の `showSaveFilePicker` を optional に扱うために使う。
 */
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

/** `showSaveFilePicker` の `types` で使う MIME / 拡張子対応。 */
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

/** 簡略化した writable file stream 型。保存処理で必要な最小 subset だけ定義する。 */
interface FileSystemWritableFileStreamLike {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

/** 保存先ファイル handle の最小 subset。 */
interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

/** Sekiei が参照する拡張 Window 型。 */
interface Window {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandleLike>;
}
