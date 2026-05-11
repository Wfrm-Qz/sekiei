import { LEGACY_LOCALE_STORAGE_KEY } from "./compat/legacyIdentifiers.js";

const LOCALE_STORAGE_KEY = "sekiei.locale";
const SUPPORTED_LOCALES = ["ja", "en"];
/**
 * 日本語 / 英語の翻訳辞書と、現在言語の保持・DOM 反映を担当する。
 *
 * plain HTML の `data-i18n*` 属性へ後から文言を流し込む構造なので、
 * 文字列辞書だけでなく「再描画トリガー」と「select 連動」もここでまとめている。
 */
/** 現在サポートしている UI ロケール。 */
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** 画面全体で使う翻訳テーブル。key は HTML の `data-i18n*` と 1:1 対応する。 */
const translations = {
  ja: {
    "common.language": "言語",
    "common.locale.ja": "日本語",
    "common.locale.en": "English",
    "common.actions": "操作",
    "common.skipToContent": "メインコンテンツへ移動",
    "common.distance": "距離",
    "common.auto": "自動",
    "common.add": "追加",
    "common.delete": "削除",
    "common.deleteAllFaces": "面を全削除",
    "common.addFace": "面を追加",
    "common.createEquivalentFace": "等価な面を作成",
    "common.expand": "展開",
    "common.collapse": "折りたたむ",
    "common.increaseField": "{label} を増やす",
    "common.decreaseField": "{label} を減らす",
    "common.sortAscending": "{label} を昇順ソート",
    "common.sortDescending": "{label} を降順ソート",
    "common.noPresetMatches": "一致するプリセットはありません",
    "mobileLayout.tabList": "スマホ向け編集カテゴリ",
    "mobileLayout.tab.basic": "基本",
    "mobileLayout.tab.face": "面",
    "mobileLayout.tab.twin": "双晶",
    "mobileLayout.tab.display": "表示",
    "mobileLayout.tab.output": "出力",
    "mobileLayout.headerMenu": "メニュー",
    "mobileLayout.displayModeLabel": "表示モード",
    "mobileLayout.displayVisibilityLabel": "表示項目",
    "mobileLayout.displayCrystalVisibilityLabel": "表示対象の結晶",
    "mobileLayout.displayAdvancedLabel": "詳細設定",
    "mobileLayout.displayAdvancedNote":
      "ラベルや線の色、太さ、詳細なプレビュー挙動を調整できます。",
    "mobileLayout.displayLabelCoreGroup": "面指数と双晶",
    "mobileLayout.displayLabelAxisGroup": "軸ラベル",
    "mobileLayout.displayLabelMetadataGroup": "プリセット表示",
    "mobileLayout.displayLineCoreGroup": "稜線と交線",
    "mobileLayout.displayLineAxisGroup": "軸線",
    "mobileLayout.outputExportLabel": "保存 / 出力",
    "mobileLayout.outputImportLabel": "JSON読み込み",
    "mobileLayout.outputProjectLabel": "プロジェクトデータ",
    "mobileLayout.outputModelLabel": "3Dモデル",
    "mobileLayout.outputPreviewImageLabel": "プレビュー画像",
    "mobileLayout.outputSaveJson": "JSON保存",
    "mobileLayout.importAll": "JSON読込（全て）",
    "mobileLayout.importCrystal": "JSON読込（結晶データ）",
    "mobileLayout.importPreview": "JSON読込（プレビュー設定）",
    "announcement.title": "お知らせ",
    "announcement.updatedAtLabel": "お知らせの更新日",
    "announcement.historyTitle": "更新履歴",
    "announcement.knownIssuesTitle": "既知の問題",
    "announcement.linksTitle": "リンク",
    "announcement.githubLink": "GitHubのレポジトリ",
    "announcement.authorXLink": "作者X",
    "announcement.feedbackLead": "バグ報告や要望、プリセットデータの提供は",
    "announcement.feedbackConnector": "か",
    "announcement.feedbackSuffix": "まで",
    "announcement.noKnownIssues": "現在確認されている既知の問題はありません。",
    "announcement.dismiss": "確認した",
    "announcement.openButton": "お知らせ",
    "announcement.closeAria": "お知らせを閉じる",
    "manual.title": "マニュアル",
    "manual.openButton": "マニュアル",
    "manual.tocTitle": "目次",
    "manual.tocToggle": "目次を開く",
    "manual.tocClose": "目次を閉じる",
    "manual.dismiss": "閉じる",
    "manual.closeAria": "マニュアルを閉じる",
    "help.genericControlFallbackLabel": "この項目",
    "help.genericControl": "{label} を操作します。",
    "help.disabled.generic": "{label} は現在の条件では操作できません。",
    "help.disabled.crystalSystemLocked":
      "現在の結晶系では自動で決まる値のため、直接編集できません。",
    "help.disabled.autoI":
      "i は h と k から自動で決まるため、直接編集できません。",
    "help.disabled.faceIndexIReadonly":
      "i は h と k から自動で決まるため、直接編集できません。",
    "help.disabled.faceGroupCollapsed":
      "等価面グループを展開すると、この値を編集できます。",
    "help.disabled.noFaces": "面がないため実行できません。",
    "help.disabled.noEquivalentFaces":
      "この面から追加できる等価面はすでに揃っています。",
    "help.disabled.baseCrystal": "結晶1は基準になるため削除できません。",
    "help.disabled.maxCrystals": "結晶は最大8個までです。",
    "help.disabled.hiddenCrystal":
      "この結晶は現在の設定で無効なため、表示を切り替えられません。",
    "help.disabled.hiddenByCrystalSystem":
      "現在の結晶系ではこの項目は使いません。",
    "help.language": "画面表示の言語を切り替えます。",
    "help.header.github": "GitHub のレポジトリを開きます。",
    "help.header.x": "作者 X を開きます。",
    "help.header.notice": "更新履歴や既知の問題を確認します。",
    "help.header.manual": "このツールのマニュアルを開きます。",
    "help.header.menu": "スマホ向けのメニューを開きます。",
    "help.header.save": "現在の内容を既定名で保存します。",
    "help.header.saveAs": "形式を選び、名前を付けて保存します。",
    "help.header.import": "JSON の読み込み方法を選びます。",
    "help.modal.dismiss": "この画面を閉じます。",
    "help.modal.close": "この画面を閉じます。",
    "help.export.json": "現在の編集内容を JSON として保存します。",
    "help.export.stl": "3Dプリント向けの STL モデルを書き出します。",
    "help.export.svg": "プレビューを SVG 画像として書き出します。",
    "help.export.png": "プレビューを PNG 画像として書き出します。",
    "help.export.jpeg": "プレビューを JPEG 画像として書き出します。",
    "help.import.all": "結晶データとプレビュー設定をまとめて読み込みます。",
    "help.import.crystal": "結晶データだけを読み込みます。",
    "help.import.preview": "プレビュー設定だけを読み込みます。",
    "help.mobile.tab": "スマホ向けの編集カテゴリを切り替えます。",
    "help.mobile.menuTab": "指定した編集カテゴリへ移動します。",
    "help.preset.query":
      "プリセットを検索して、結晶パラメーターと面一覧の初期値を読み込みます。",
    "help.preset.clear": "プリセット入力を空にします。",
    "help.preset.options": "プリセット候補を表示します。",
    "help.preset.metadataToggle":
      "プリセット情報の詳細項目を表示または折りたたみます。",
    "help.preset.metadata.name":
      "保存するプリセット名を入力します。空でもモデル作成はできます。",
    "help.preset.metadata.shortDescription":
      "プリセットの短い説明を入力します。",
    "help.preset.metadata.altName":
      "もう一方の言語で表示するプリセット名を入力します。",
    "help.preset.metadata.description": "プリセットの説明を入力します。",
    "help.preset.metadata.reference":
      "プリセットデータの主な出典を入力します。",
    "help.preset.metadata.fullReference": "出典の詳細や補足情報を入力します。",
    "help.crystal.system":
      "結晶系を選びます。軸比や角度の一部は結晶系に合わせて自動固定されます。",
    "help.crystal.size": "完成モデルの基準サイズを mm 単位で指定します。",
    "help.crystal.axisRatio":
      "{label} 軸の長さの比率を調整します。絶対寸法ではなく、軸同士の比です。",
    "help.crystal.axisAngle": "{label} の軸間角を度数で調整します。",
    "help.crystal.add": "面一覧で編集する結晶を追加します。",
    "help.crystal.tab": "面一覧で編集する結晶を切り替えます。",
    "help.crystal.menu": "結晶の複製、色変更、削除メニューを開きます。",
    "help.crystal.duplicate": "この結晶を複製して新しい結晶を作ります。",
    "help.crystal.delete": "この結晶を削除します。",
    "help.crystal.color": "この結晶の表示色を変更します。",
    "help.stlSplit.enabled": "STL 出力時に、指定した面でモデルを分割します。",
    "help.stlSplit.planeIndex": "STL 分割に使う面の {label} 指数を指定します。",
    "help.twin.fromCrystal": "この結晶を作る元の結晶を選びます。",
    "help.twin.type": "接触双晶または貫入双晶を選びます。",
    "help.twin.ruleIndex": "双晶則に使う {label} 指数を指定します。",
    "help.twin.rotation": "双晶を配置するときの回転角を指定します。",
    "help.twin.axisOffset":
      "貫入双晶を双晶軸方向へずらします。1 は双晶軸に対応する距離1面までの距離です。",
    "help.twin.baseContactFace": "生成元結晶側で接触させる面を選びます。",
    "help.twin.derivedContactFace": "この結晶側で接触させる面を選びます。",
    "help.twin.referenceAxis": "接触面上で向きを合わせる基準方向を選びます。",
    "help.preview.reset": "プレビューの向きと拡大率を見やすい状態に戻します。",
    "help.preview.inertia":
      "ドラッグ後に回転を少しだけ続けるかを切り替えます。",
    "help.preview.axisView":
      "正の {label} 軸側から結晶中心を見る視点に切り替えます。",
    "help.preview.faceDisplay": "面の色や透明度の表示モードを切り替えます。",
    "help.preview.toggle.faceLabels": "面指数ラベルの表示を切り替えます。",
    "help.preview.toggle.ridgeLines": "稜線の表示を切り替えます。",
    "help.preview.toggle.intersectionLines":
      "刻印文字と面の交線の表示を切り替えます。",
    "help.preview.toggle.axisInner": "モデル内部の軸線表示を切り替えます。",
    "help.preview.toggle.axisOuter": "モデル外側の軸線表示を切り替えます。",
    "help.preview.toggle.axisLabels": "軸ラベルの表示を切り替えます。",
    "help.preview.toggle.twinRule": "双晶軸または双晶面の表示を切り替えます。",
    "help.preview.toggle.metadata":
      "プリセット名などのラベル表示を切り替えます。",
    "help.preview.toggle.splitPlane": "STL 分割面のガイド表示を切り替えます。",
    "help.preview.crystalVisibility":
      "この結晶をプレビューに表示するか切り替えます。",
    "help.previewStyle.summary": "プレビューの見た目の詳細設定を開閉します。",
    "help.previewStyle.resetBasic":
      "プレビュー詳細設定をデフォルト値に戻します。",
    "help.previewStyle.resetAdvanced": "高度な設定をデフォルト値に戻します。",
    "help.previewStyle.field": "プレビュー上のラベルや線の見た目を調整します。",
    "help.face.clearAll": "現在の結晶に登録されている面をすべて削除します。",
    "help.face.add": "現在の結晶に新しい面を追加します。",
    "help.face.sort": "{label}",
    "help.face.enabledToggle": "この面をモデル生成に使うか切り替えます。",
    "help.face.groupToggle": "等価な面のグループを展開または折りたたみます。",
    "help.face.index.h":
      "a 軸方向に対する面の向きを変えます。0 の場合、その面は a 軸とは交わりません。",
    "help.face.index.k":
      "b 軸方向に対する面の向きを変えます。0 の場合、その面は b 軸とは交わりません。",
    "help.face.index.i":
      "六方晶系/三方晶系で使う補助指数です。h と k から自動で決まります。",
    "help.face.index.l":
      "c 軸方向に対する面の向きを変えます。0 の場合、その面は c 軸とは交わりません。",
    "help.face.indexStep": "{label} の値を 1 ずつ増減します。",
    "help.face.distance":
      "面の位置を決める距離です。1 は各軸切片の基準位置、2 はその 2 倍、0 や負の値も指定できます。",
    "help.face.distanceStep": "距離を段階的に増減します。",
    "help.face.color": "この面または等価面グループの色を変更します。",
    "help.face.textToggle": "この面に入れる刻印文字の設定を開閉します。",
    "help.face.equivalent": "現在の面から等価な面を追加します。",
    "help.face.remove": "この面を削除します。",
    "help.faceText.field": "面に入れる刻印文字の表示内容や位置を調整します。",
    "common.jsonLoadFailed": "JSON の読み込みに失敗しました: {message}",
    "app.pageTitle": "Sekiei",
    "app.headerTitle": "SEKIEI",
    "app.headerExpansion":
      "Shape Editor for Kessho Illustration, Export, and Inscription",
    "app.subtitle":
      "オフラインで結晶の3Dモデルを作成し、STL / SVG / PNG / JPEG形式で出力できます",
    "app.save": "保存",
    "app.saveAs": "名前を付けて保存",
    "import.jsonMode": "JSON読込対象",
    "import.jsonMode.all": "全て",
    "import.jsonMode.previewSettings": "プレビュー設定",
    "import.jsonMode.crystalData": "結晶データ",
    "import.json": "JSONを読み込む",
    "import.missingPreviewSettings":
      "この JSON にはプレビュー設定が含まれていません。",
    "preset.placeholder": "プリセット選択",
    "preset.clearInput": "プリセット入力をクリア",
    "preset.showOptions": "プリセット候補を表示",
    "editor.presetInfoTitle": "プリセット情報",
    "preset.metadata.name": "名前",
    "preset.metadata.shortDescription": "簡易説明",
    "preset.metadata.description": "説明",
    "preset.metadata.reference": "参考文献",
    "preset.metadata.fullReference": "参考文献詳細",
    "preset.metadata.nameEnglish": "名前（英語）",
    "preset.metadata.nameJapanese": "名前（日本語）",
    "preset.metadataToggle.more": "詳細表示",
    "preset.metadataToggle.less": "折り畳み",
    "editor.parametersTitle": "結晶パラメーター",
    "editor.crystalSystem": "結晶系",
    "editor.modelSize": "モデルサイズ (mm)",
    "editor.axisLengths": "軸比",
    "editor.axisAngles": "軸間角 (deg)",
    "editor.stlSplitEnabled": "STL分割を有効にする（β版）",
    "twin.settingsTitle": "双晶パラメーター",
    "twin.settingsDescription":
      "選択中の派生結晶について、生成元結晶、双晶タイプ、双晶則、接触面指定を設定します。",
    "twin.fromCrystal": "生成元結晶",
    "twin.twinType": "双晶タイプ",
    "twin.type.contact": "接触双晶",
    "twin.type.penetration": "貫入双晶",
    "twin.ruleIndex.axis": "双晶軸指数",
    "twin.ruleIndex.plane": "双晶面指数",
    "twin.rotationAngle": "回転角 (deg)",
    "twin.axisOffset": "軸方向オフセット",
    "twin.baseContactFace": "生成元結晶 {index} の接触面",
    "twin.derivedContactFace": "{label} の接触面",
    "twin.referenceAxis": "基準方向",
    "editor.validationTitle": "検証結果",
    "preview.controlsHint":
      "操作: 左ドラッグで回転、右ドラッグで平行移動、ホイールで拡大縮小。",
    "preview.mobileControlsHint": "操作: 1本指で回転、2本指で拡大縮小。",
    "preview.axisViewButtons": "軸方向から見るボタン",
    "preview.useInertia": "回転の慣性",
    "preview.reset": "視点リセット",
    "preview.faceDisplay.grouped": "等価面",
    "preview.faceDisplay.solid": "単色",
    "preview.faceDisplay.white": "グレー",
    "preview.faceDisplay.transparent": "無色透明",
    "preview.faceDisplay.xraySolid": "半透明（単色）",
    "preview.faceDisplay.xrayGrouped": "半透明（等価面）",
    "preview.faceDisplay.custom": "カスタム(β版)",
    "preview.toggle.faceIndices": "面指数",
    "preview.toggle.ridgeLines": "稜線",
    "preview.toggle.intersectionLines": "交線",
    "preview.toggle.axisInner": "軸（内）",
    "preview.toggle.axisOuter": "軸（外）",
    "preview.toggle.axisLinesInner": "軸線（内）",
    "preview.toggle.axisLinesOuter": "軸線（外）",
    "preview.toggle.axisLabels": "軸ラベル",
    "preview.toggle.twinRule": "双晶軸 / 双晶面",
    "preview.toggle.metadata": "ラベル",
    "preview.toggle.splitPlane": "分割面",
    "preview.settingsSummary": "プレビュー詳細設定",
    "preview.settings.labelsTitle": "ラベル",
    "preview.settings.linesTitle": "線と軸",
    "preview.settings.faceLabel": "面指数の色",
    "preview.settings.faceLabelFont": "面指数フォント",
    "preview.settings.fontSize": "フォントサイズ",
    "preview.settings.faceLabelOffset": "面からのオフセット量",
    "preview.settings.axisLabel": "軸ラベル",
    "preview.settings.axisLabelColorA": "a軸ラベルの色",
    "preview.settings.axisLabelColorA1": "a1軸ラベルの色",
    "preview.settings.axisLabelColorB": "b軸ラベルの色",
    "preview.settings.axisLabelColorA2": "a2軸ラベルの色",
    "preview.settings.axisLabelColorA3": "a3軸ラベルの色",
    "preview.settings.axisLabelColorC": "c軸ラベルの色",
    "preview.settings.axisLabelFont": "軸ラベルフォント",
    "preview.settings.axisLabelSize": "軸ラベルサイズ",
    "preview.settings.twinRuleLabel": "双晶ラベルの色",
    "preview.settings.twinRuleLabelFont": "双晶ラベルフォント",
    "preview.settings.twinRuleLabelSize": "双晶ラベルサイズ",
    "preview.settings.metadataTitle": "プリセット名の色",
    "preview.settings.metadataTitleFont": "プリセット名フォント",
    "preview.settings.metadataTitleSize": "プリセット名サイズ",
    "preview.settings.metadataDescription": "簡易説明の色",
    "preview.settings.metadataDescriptionFont": "簡易説明フォント",
    "preview.settings.metadataDescriptionSize": "簡易説明サイズ",
    "preview.settings.axisColorA": "a軸の色",
    "preview.settings.axisColorA1": "a1軸の色",
    "preview.settings.axisColorB": "b軸の色",
    "preview.settings.axisColorA2": "a2軸の色",
    "preview.settings.axisColorA3": "a3軸の色",
    "preview.settings.axisColorC": "c軸の色",
    "preview.settings.axisWidthInner": "軸線（内）の太さ",
    "preview.settings.axisWidthOuter": "軸線（外）の太さ",
    "preview.settings.ridgeColor": "稜線の色",
    "preview.settings.ridgeWidth": "稜線の太さ",
    "preview.settings.ridgeOpacity": "稜線の透明度",
    "preview.settings.intersectionColor": "交線の色",
    "preview.settings.intersectionWidth": "交線の太さ",
    "preview.settings.intersectionOpacity": "交線の透明度",
    "preview.advancedSettingsTitle": "高度な設定(β版)",
    "preview.settings.resetBasicToDefault":
      "プレビュー詳細設定をデフォルトに戻す",
    "preview.settings.resetAdvancedToDefault": "高度な設定をデフォルトに戻す",
    "preview.settings.customProfileDescription":
      "ここで編集した内容はカスタム選択時に有効になります。",
    "preview.settings.customFaceTitle": "面profile",
    "preview.settings.customLineTitle": "線profile",
    "preview.settings.custom.surfaceStyle": "surfaceStyle",
    "preview.settings.custom.materialKind": "materialKind",
    "preview.settings.custom.baseColorMode": "baseColorMode",
    "preview.settings.custom.usesLighting": "usesLighting",
    "preview.settings.custom.usesScreenSpaceFaceOverlay":
      "usesScreenSpaceFaceOverlay",
    "preview.settings.custom.opacityWhenHasFinal": "opacityWhenHasFinal",
    "preview.settings.custom.opacityWhenNoFinal": "opacityWhenNoFinal",
    "preview.settings.custom.depthWrite": "depthWrite",
    "preview.settings.custom.usePolygonOffset": "usePolygonOffset",
    "preview.settings.custom.polygonOffsetFactor": "polygonOffsetFactor",
    "preview.settings.custom.polygonOffsetUnits": "polygonOffsetUnits",
    "preview.settings.custom.useVertexColorsOnMergedGeometry":
      "useVertexColorsOnMergedGeometry",
    "preview.settings.custom.componentBuildMode": "componentBuildMode",
    "preview.settings.custom.preferFinalMergedGeometry":
      "preferFinalMergedGeometry",
    "preview.settings.custom.allowSharedSolidFaceColorMap":
      "allowSharedSolidFaceColorMap",
    "preview.settings.custom.allowSharedSolidFaceOverlay":
      "allowSharedSolidFaceOverlay",
    "preview.settings.custom.usesFaceGroupPalette": "usesFaceGroupPalette",
    "preview.settings.custom.groupedFaceComponentOpacity":
      "groupedFaceComponentOpacity",
    "preview.settings.custom.useLayeredLines": "useLayeredLines",
    "preview.settings.custom.useDepthMask": "useDepthMask",
    "preview.settings.custom.useScreenSpaceLineOverlay":
      "useScreenSpaceLineOverlay",
    "preview.settings.custom.showFrontLines": "showFrontLines",
    "preview.settings.custom.showHiddenSurfaceLines": "showHiddenSurfaceLines",
    "preview.settings.custom.showOccludedInteriorLines":
      "showOccludedInteriorLines",
    "preview.settings.custom.hiddenSurfaceLineColorMode":
      "hiddenSurfaceLineColorMode",
    "preview.settings.custom.hiddenSurfaceLineCustomColor":
      "hiddenSurfaceLineCustomColor",
    "preview.settings.custom.hiddenSurfaceLineOpacityScale":
      "hiddenSurfaceLineOpacityScale",
    "preview.settings.custom.hiddenSurfaceLineWidthScale":
      "hiddenSurfaceLineWidthScale",
    "preview.settings.custom.occludedInteriorLineColorMode":
      "occludedInteriorLineColorMode",
    "preview.settings.custom.occludedInteriorLineCustomColor":
      "occludedInteriorLineCustomColor",
    "preview.settings.custom.occludedInteriorLineOpacityScale":
      "occludedInteriorLineOpacityScale",
    "preview.settings.custom.occludedInteriorLineWidthScale":
      "occludedInteriorLineWidthScale",
    "preview.settings.custom.resolutionMode": "resolutionMode",
    "preview.settings.custom.depthMaskOffsetFactor": "depthMaskOffsetFactor",
    "preview.settings.custom.depthMaskOffsetUnits": "depthMaskOffsetUnits",
    "preview.settings.debugTitle": "デバッグ",
    "preview.settings.debugDescription":
      "現在設定と preview/xray debug 情報を JSON にまとめて保存します。",
    "preview.settings.downloadDebugSnapshot": "デバッグ情報を保存",
    "editor.faceListTitle": "面一覧",
    "faceText.content": "刻印文字",
    "faceText.toggleOpen": "文字",
    "faceText.toggleClose": "閉じる",
    "faceText.font": "フォント",
    "faceText.fontSize": "文字サイズ (mm)",
    "faceText.depth": "深さ (mm)",
    "faceText.offsetU": "横位置",
    "faceText.offsetV": "縦位置",
    "faceText.rotation": "回転角 (deg)",
    "editor.faceTarget": "面一覧の編集対象",
    "crystals.add": "結晶を追加",
    "crystals.first": "結晶1",
    "crystals.indexed": "結晶{index}",
    "crystals.firstShort": "結晶1",
    "crystals.indexedShort": "結晶{index}",
    "crystals.duplicate": "結晶を複製",
    "crystals.changeColor": "色の変更",
    "crystals.colorLabel": "色",
    "crystals.delete": "結晶削除",
    "crystals.tabMenuAria": "{label} の操作",
    "validation.validInput": "入力値は現在の条件では有効です。",
    "export.failed.svg": "SVG の書き出しに失敗しました: {message}",
    "export.failed.png": "PNG の書き出しに失敗しました: {message}",
    "export.failed.jpeg": "JPEG の書き出しに失敗しました: {message}",
    "export.error.exportCanvas": "書き出し用 canvas を生成できませんでした。",
    "export.error.pngBlob": "PNG blob を生成できませんでした。",
    "export.error.jpegBlob": "JPEG blob を生成できませんでした。",
    "export.error.splitPlaneInvalid":
      "分割平面の面指数から有効な法線を計算できませんでした。",
    "export.error.splitStlPlane":
      "分割 STL の書き出しに失敗しました: {message}",
    "crystals.deleteConfirm": "この結晶を削除しますか。",
    "faces.clearConfirm": "面をすべて削除しますか。",
    "twin.settingsNote.base":
      "結晶1には双晶則を設定しません。派生結晶タブを選ぶと、その結晶ごとの生成元・双晶タイプ・双晶則を編集できます。",
    "twin.settingsNote.derived": "{label} の双晶則を設定します。",
    "faceList.faceLabel": "面 {index} ({faceIndexText})",
    "faceList.showFaceTitle": "面を表示",
    "preset.custom.label": "カスタム入力",
    "preset.custom.description": "現在の手入力を保持します。",
    "system.cubic": "立方晶系",
    "system.tetragonal": "正方晶系",
    "system.orthorhombic": "直方晶系",
    "system.hexagonal": "六方晶系",
    "system.trigonal": "三方晶系",
    "system.monoclinic": "単斜晶系",
    "system.triclinic": "三斜晶系",
    "geometry.warning.minEdge":
      "最小稜線長が {value} mm と短く、細線として造形しづらい可能性があります。",
    "geometry.warning.minInradius":
      "最小面内半径が {value} mm と小さく、肉厚不足になる可能性があります。",
    "geometry.warning.slender":
      "モデルの縦横比が {value} と大きく、細長くて造形時に不安定になる可能性があります。",
    "geometry.error.axisPositive": "軸長 {axisName} は正の数にしてください。",
    "geometry.error.angleRange":
      "角度 {angleName} は 0 より大きく 180 未満にしてください。",
    "geometry.error.modelSize": "モデルサイズは正の数にしてください。",
    "geometry.error.invalidAxisAngles":
      "軸角の組み合わせが幾何学的に不正です。",
    "geometry.error.faceDistance":
      "面 {index} の距離は有限な数値にしてください。",
    "geometry.error.faceIndexNumeric":
      "面 {index} のミラー指数は数値にしてください。",
    "geometry.error.faceIndexINumeric":
      "面 {index} の i 指数は数値にしてください。",
    "geometry.error.faceZeroIndex":
      "面 {index} のミラー指数は 0,0,0 にできません。",
    "geometry.error.faceFourAxisRule":
      "面 {index} は六方晶系/三方晶系のため h + k + i = 0 を満たす必要があります。",
    "geometry.warning.closedSolidNeedsFaces":
      "閉じた立体には通常 4 面以上が必要です。",
    "geometry.warning.faceNormalIgnored":
      "面 {index} の法線が計算できないため無視されました。",
    "geometry.faceLabel": "面 {index}",
    "geometry.error.notEnoughFaces":
      "有効な面が不足しているため閉じた立体を生成できません。",
    "geometry.error.cannotBuildClosedSolid":
      "面の組み合わせから閉じた立体を生成できません。",
    "geometry.error.cannotBuildPolygons":
      "有効な面ポリゴンを十分に構成できませんでした。",
    "builder.unionDiagnostic": "[和集合診断] {message}",
    "builder.error.invalidAxisVector":
      "双晶軸から有効な方向ベクトルを計算できません。",
    "builder.error.invalidPlaneNormal":
      "双晶面から有効な法線を計算できません。",
    "builder.error.ruleMatrixFailed":
      "双晶則の変換行列を構成できません: {message}",
    "builder.error.contactFaceMissing":
      "結晶 {index} の接触双晶で指定した接触面が結晶表面として見つかりません。",
    "builder.error.contactFaceTracking":
      "結晶 {index} の接触双晶の配置中に接触面を追跡できませんでした。",
    "builder.warning.contactAlignFallback":
      "結晶 {index} の接触面法線の向き合わせが完全ではありません。面重心一致による簡易配置を適用しました。",
    "builder.warning.contactCentroidFallback":
      "結晶 {index} の接触双晶は面重心一致による簡易配置を適用しています。",
    "builder.error.crystalBuildFailed":
      "結晶 {index} の立体生成に失敗しました。",
    "builder.warning.parentMissing":
      "結晶 {index} は生成元結晶 {parentIndex} を参照できないため表示対象から外しました。",
    "builder.warning.parentDisabled":
      "結晶 {index} の生成元結晶 {parentIndex} が無効なため、和集合対象から除外しました。",
    "builder.error.csgAborted":
      "CSG 実行前に中断しました。validPlacedBuilds={validPlacedBuilds}, validation.errors={validationErrors}",
    "builder.warning.partialCrystalDisplay":
      "一部の結晶は閉じた立体を生成できなかったため、有効な結晶のみを表示します。",
    "builder.unionDiagnosticException": "CSG 例外: {message}",
    "builder.warning.unionFallback":
      "双晶和集合に失敗したため、和集合前の有効な結晶をそのまま表示・書き出しします: {message}",
  },
  en: {
    "common.language": "Language",
    "common.locale.ja": "Japanese",
    "common.locale.en": "English",
    "common.actions": "Actions",
    "common.skipToContent": "Skip to main content",
    "common.distance": "Distance",
    "common.auto": "Auto",
    "common.add": "Add",
    "common.delete": "Delete",
    "common.deleteAllFaces": "Delete All Faces",
    "common.addFace": "Add Face",
    "common.createEquivalentFace": "Create Equivalent Faces",
    "common.expand": "Expand",
    "common.collapse": "Collapse",
    "common.increaseField": "Increase {label}",
    "common.decreaseField": "Decrease {label}",
    "common.sortAscending": "Sort {label} in ascending order",
    "common.sortDescending": "Sort {label} in descending order",
    "common.noPresetMatches": "No matching presets found",
    "mobileLayout.tabList": "Mobile editing categories",
    "mobileLayout.tab.basic": "Basics",
    "mobileLayout.tab.face": "Faces",
    "mobileLayout.tab.twin": "Twin",
    "mobileLayout.tab.display": "Display",
    "mobileLayout.tab.output": "Output",
    "mobileLayout.headerMenu": "Menu",
    "mobileLayout.displayModeLabel": "Display Mode",
    "mobileLayout.displayVisibilityLabel": "Visible Items",
    "mobileLayout.displayCrystalVisibilityLabel": "Visible Crystals",
    "mobileLayout.displayAdvancedLabel": "Advanced Settings",
    "mobileLayout.displayAdvancedNote":
      "Adjust label and line styling, plus detailed preview behavior.",
    "mobileLayout.displayLabelCoreGroup": "Face and Twin Labels",
    "mobileLayout.displayLabelAxisGroup": "Axis Labels",
    "mobileLayout.displayLabelMetadataGroup": "Preset Overlay",
    "mobileLayout.displayLineCoreGroup": "Ridge and Intersection Lines",
    "mobileLayout.displayLineAxisGroup": "Axis Lines",
    "mobileLayout.outputExportLabel": "Save / Export",
    "mobileLayout.outputImportLabel": "Import JSON",
    "mobileLayout.outputProjectLabel": "Project Data",
    "mobileLayout.outputModelLabel": "3D Model",
    "mobileLayout.outputPreviewImageLabel": "Preview Images",
    "mobileLayout.outputSaveJson": "Save JSON",
    "mobileLayout.importAll": "Import JSON (All)",
    "mobileLayout.importCrystal": "Import JSON (Crystal Data)",
    "mobileLayout.importPreview": "Import JSON (Preview Settings)",
    "announcement.title": "Notice",
    "announcement.updatedAtLabel": "Updated",
    "announcement.historyTitle": "Update History",
    "announcement.knownIssuesTitle": "Known Issues",
    "announcement.linksTitle": "Links",
    "announcement.githubLink": "GitHub repository",
    "announcement.authorXLink": "Author on X",
    "announcement.feedbackLead":
      "For bug reports, requests, and preset data submissions, please use",
    "announcement.feedbackConnector": "or",
    "announcement.feedbackSuffix": ".",
    "announcement.noKnownIssues": "There are no known issues listed right now.",
    "announcement.dismiss": "Got it",
    "announcement.openButton": "Updates",
    "announcement.closeAria": "Close announcement",
    "manual.title": "Manual",
    "manual.openButton": "Manual",
    "manual.tocTitle": "Contents",
    "manual.tocToggle": "Open contents",
    "manual.tocClose": "Close contents",
    "manual.dismiss": "Close",
    "manual.closeAria": "Close manual",
    "help.genericControlFallbackLabel": "this item",
    "help.genericControl": "Use {label}.",
    "help.disabled.generic": "{label} cannot be used in the current state.",
    "help.disabled.crystalSystemLocked":
      "This value is determined automatically by the current crystal system.",
    "help.disabled.autoI":
      "i is determined automatically from h and k, so it cannot be edited directly.",
    "help.disabled.faceIndexIReadonly":
      "i is determined automatically from h and k, so it cannot be edited directly.",
    "help.disabled.faceGroupCollapsed":
      "Expand the equivalent-face group to edit this value.",
    "help.disabled.noFaces": "There are no faces to remove.",
    "help.disabled.noEquivalentFaces":
      "All equivalent faces that can be added from this face already exist.",
    "help.disabled.baseCrystal":
      "Crystal 1 is the base crystal and cannot be deleted.",
    "help.disabled.maxCrystals": "Up to 8 crystals can be used.",
    "help.disabled.hiddenCrystal":
      "This crystal is disabled by the current settings, so its visibility cannot be changed.",
    "help.disabled.hiddenByCrystalSystem":
      "This item is not used by the current crystal system.",
    "help.language": "Switch the display language.",
    "help.header.github": "Open the GitHub repository.",
    "help.header.x": "Open the author's X profile.",
    "help.header.notice": "Review update history and known issues.",
    "help.header.manual": "Open the manual for this tool.",
    "help.header.menu": "Open the mobile menu.",
    "help.header.save": "Save the current content with the default name.",
    "help.header.saveAs": "Choose a format and save with a new name.",
    "help.header.import": "Choose how to import JSON.",
    "help.modal.dismiss": "Close this panel.",
    "help.modal.close": "Close this panel.",
    "help.export.json": "Save the current project as JSON.",
    "help.export.stl": "Export an STL model for 3D printing.",
    "help.export.svg": "Export the preview as an SVG image.",
    "help.export.png": "Export the preview as a PNG image.",
    "help.export.jpeg": "Export the preview as a JPEG image.",
    "help.import.all": "Import both crystal data and preview settings.",
    "help.import.crystal": "Import only crystal data.",
    "help.import.preview": "Import only preview settings.",
    "help.mobile.tab": "Switch the mobile editing category.",
    "help.mobile.menuTab": "Move to the selected editing category.",
    "help.preset.query":
      "Search presets and load initial crystal parameters and faces.",
    "help.preset.clear": "Clear the preset input.",
    "help.preset.options": "Show preset candidates.",
    "help.preset.metadataToggle":
      "Show or collapse the detailed preset information fields.",
    "help.preset.metadata.name":
      "Enter the preset name. The model can still be created when this is blank.",
    "help.preset.metadata.shortDescription":
      "Enter a short description for the preset.",
    "help.preset.metadata.altName":
      "Enter the preset name shown in the other language.",
    "help.preset.metadata.description": "Enter the preset description.",
    "help.preset.metadata.reference":
      "Enter the main source for the preset data.",
    "help.preset.metadata.fullReference":
      "Enter detailed citation or supplementary source information.",
    "help.crystal.system":
      "Choose the crystal system. Some axis ratios and angles are locked automatically.",
    "help.crystal.size": "Set the reference model size in millimeters.",
    "help.crystal.axisRatio":
      "Adjust the length ratio of the {label} axis. This is a ratio, not an absolute size.",
    "help.crystal.axisAngle": "Adjust the {label} interaxial angle in degrees.",
    "help.crystal.add": "Add a crystal to edit in the face list.",
    "help.crystal.tab": "Switch the crystal edited in the face list.",
    "help.crystal.menu": "Open duplicate, color, and delete actions.",
    "help.crystal.duplicate": "Duplicate this crystal as a new crystal.",
    "help.crystal.delete": "Delete this crystal.",
    "help.crystal.color": "Change the display color for this crystal.",
    "help.stlSplit.enabled":
      "Split the model by the specified plane when exporting STL.",
    "help.stlSplit.planeIndex":
      "Set the {label} index of the plane used for STL splitting.",
    "help.twin.fromCrystal": "Choose the source crystal for this crystal.",
    "help.twin.type": "Choose a contact twin or penetration twin.",
    "help.twin.ruleIndex": "Set the {label} index used by the twin law.",
    "help.twin.rotation": "Set the rotation angle used to place the twin.",
    "help.twin.axisOffset":
      "Move a penetration twin along its twin axis. 1 means the distance to the distance-1 plane for that twin axis.",
    "help.twin.baseContactFace":
      "Choose the contact face on the source crystal.",
    "help.twin.derivedContactFace": "Choose the contact face on this crystal.",
    "help.twin.referenceAxis":
      "Choose the reference direction used to align the contact face.",
    "help.preview.reset": "Reset the preview orientation and zoom.",
    "help.preview.inertia":
      "Toggle whether rotation continues briefly after dragging.",
    "help.preview.axisView":
      "Switch to a view from the positive {label}-axis side toward the crystal center.",
    "help.preview.faceDisplay": "Switch face color and transparency mode.",
    "help.preview.toggle.faceLabels": "Show or hide face index labels.",
    "help.preview.toggle.ridgeLines": "Show or hide ridge lines.",
    "help.preview.toggle.intersectionLines":
      "Show or hide intersections between engraved text and faces.",
    "help.preview.toggle.axisInner": "Show or hide internal axis lines.",
    "help.preview.toggle.axisOuter": "Show or hide outer axis lines.",
    "help.preview.toggle.axisLabels": "Show or hide axis labels.",
    "help.preview.toggle.twinRule": "Show or hide the twin axis or twin plane.",
    "help.preview.toggle.metadata": "Show or hide preset labels.",
    "help.preview.toggle.splitPlane": "Show or hide the STL split-plane guide.",
    "help.preview.crystalVisibility":
      "Show or hide this crystal in the preview.",
    "help.previewStyle.summary": "Open or close detailed preview styling.",
    "help.previewStyle.resetBasic":
      "Reset preview detail settings to their defaults.",
    "help.previewStyle.resetAdvanced":
      "Reset advanced settings to their defaults.",
    "help.previewStyle.field": "Adjust preview label or line styling.",
    "help.face.clearAll": "Remove all faces registered on the current crystal.",
    "help.face.add": "Add a new face to the current crystal.",
    "help.face.sort": "{label}",
    "help.face.enabledToggle":
      "Use or ignore this face when generating the model.",
    "help.face.groupToggle": "Expand or collapse this equivalent-face group.",
    "help.face.index.h":
      "Change the face direction relative to the a axis. When this is 0, the face does not intersect the a axis.",
    "help.face.index.k":
      "Change the face direction relative to the b axis. When this is 0, the face does not intersect the b axis.",
    "help.face.index.i":
      "This auxiliary index is used for hexagonal/trigonal systems and is determined from h and k.",
    "help.face.index.l":
      "Change the face direction relative to the c axis. When this is 0, the face does not intersect the c axis.",
    "help.face.indexStep": "Increase or decrease {label} by 1.",
    "help.face.distance":
      "This signed distance sets the face position. 1 uses the base intercepts, 2 doubles them, and 0 or negative values are allowed.",
    "help.face.distanceStep": "Increase or decrease the distance step by step.",
    "help.face.color":
      "Change the color of this face or equivalent-face group.",
    "help.face.textToggle":
      "Open or close engraved text settings for this face.",
    "help.face.equivalent": "Add equivalent faces from the current face.",
    "help.face.remove": "Remove this face.",
    "help.faceText.field":
      "Adjust the content, appearance, or position of engraved text on this face.",
    "common.jsonLoadFailed": "Failed to load JSON: {message}",
    "app.pageTitle": "Sekiei",
    "app.headerTitle": "SEKIEI",
    "app.headerExpansion":
      "Shape Editor for Kessho Illustration, Export, and Inscription",
    "app.subtitle":
      "Create crystal 3D models offline and export them as STL / SVG / PNG / JPEG.",
    "app.save": "Save",
    "app.saveAs": "Save As...",
    "import.jsonMode": "JSON Import Scope",
    "import.jsonMode.all": "All",
    "import.jsonMode.previewSettings": "Preview Settings",
    "import.jsonMode.crystalData": "Crystal Data",
    "import.json": "Import JSON",
    "import.missingPreviewSettings":
      "This JSON does not include preview settings.",
    "preset.placeholder": "Select preset",
    "preset.clearInput": "Clear preset input",
    "preset.showOptions": "Show preset options",
    "editor.presetInfoTitle": "Preset Information",
    "preset.metadata.name": "Name",
    "preset.metadata.shortDescription": "Short Description",
    "preset.metadata.description": "Description",
    "preset.metadata.reference": "Reference",
    "preset.metadata.fullReference": "Full Reference",
    "preset.metadata.nameEnglish": "Name (English)",
    "preset.metadata.nameJapanese": "Name (Japanese)",
    "preset.metadataToggle.more": "Show Details",
    "preset.metadataToggle.less": "Collapse",
    "editor.parametersTitle": "Crystal Parameters",
    "editor.crystalSystem": "Crystal System",
    "editor.modelSize": "Model Size (mm)",
    "editor.axisLengths": "Axis Ratios",
    "editor.axisAngles": "Interaxial Angles (deg)",
    "editor.stlSplitEnabled": "Enable STL Split (beta)",
    "twin.settingsTitle": "Twin Parameters",
    "twin.settingsDescription":
      "Set the source crystal, twin type, twin law, and contact-face assignment for the selected derived crystal.",
    "twin.fromCrystal": "Source Crystal",
    "twin.twinType": "Twin Type",
    "twin.type.contact": "Contact Twin",
    "twin.type.penetration": "Penetration Twin",
    "twin.ruleIndex.axis": "Twin Axis Indices",
    "twin.ruleIndex.plane": "Twin Plane Indices",
    "twin.rotationAngle": "Rotation Angle (deg)",
    "twin.axisOffset": "Axis Offset",
    "twin.baseContactFace": "Contact Face of Crystal {index}",
    "twin.derivedContactFace": "Contact Face of {label}",
    "twin.referenceAxis": "Reference Direction",
    "editor.validationTitle": "Validation",
    "preview.controlsHint":
      "Controls: Left drag to rotate, right drag to pan, mouse wheel to zoom.",
    "preview.mobileControlsHint":
      "Controls: Rotate with one finger. Use two fingers to zoom.",
    "preview.axisViewButtons": "Axis view buttons",
    "preview.useInertia": "Rotation Inertia",
    "preview.reset": "Reset View",
    "preview.faceDisplay.grouped": "Equivalent Faces",
    "preview.faceDisplay.solid": "Single Color",
    "preview.faceDisplay.white": "Gray",
    "preview.faceDisplay.transparent": "Colorless Transparent",
    "preview.faceDisplay.xraySolid": "Translucent (Single Color)",
    "preview.faceDisplay.xrayGrouped": "Translucent (Equivalent Faces)",
    "preview.faceDisplay.custom": "Custom (beta)",
    "preview.toggle.faceIndices": "Face Indices",
    "preview.toggle.ridgeLines": "Ridge Lines",
    "preview.toggle.intersectionLines": "Intersection Lines",
    "preview.toggle.axisInner": "Axis (Inner)",
    "preview.toggle.axisOuter": "Axis (Outer)",
    "preview.toggle.axisLinesInner": "Axis Lines (Inner)",
    "preview.toggle.axisLinesOuter": "Axis Lines (Outer)",
    "preview.toggle.axisLabels": "Axis Labels",
    "preview.toggle.twinRule": "Twin Axis / Plane",
    "preview.toggle.metadata": "Labels",
    "preview.toggle.splitPlane": "Split Plane",
    "preview.settingsSummary": "Preview Detail Settings",
    "preview.settings.labelsTitle": "Labels",
    "preview.settings.linesTitle": "Lines and Axes",
    "preview.settings.faceLabel": "Face Index Color",
    "preview.settings.faceLabelFont": "Face Index Font",
    "preview.settings.fontSize": "Font Size",
    "preview.settings.faceLabelOffset": "Offset from Face",
    "preview.settings.axisLabel": "Axis labels",
    "preview.settings.axisLabelColorA": "a-Axis Label Color",
    "preview.settings.axisLabelColorA1": "a1-Axis Label Color",
    "preview.settings.axisLabelColorB": "b-Axis Label Color",
    "preview.settings.axisLabelColorA2": "a2-Axis Label Color",
    "preview.settings.axisLabelColorA3": "a3-Axis Label Color",
    "preview.settings.axisLabelColorC": "c-Axis Label Color",
    "preview.settings.axisLabelFont": "Axis Label Font",
    "preview.settings.axisLabelSize": "Axis Label Size",
    "preview.settings.twinRuleLabel": "Twin Label Color",
    "preview.settings.twinRuleLabelFont": "Twin Label Font",
    "preview.settings.twinRuleLabelSize": "Twin Label Size",
    "preview.settings.metadataTitle": "Preset Name Color",
    "preview.settings.metadataTitleFont": "Preset Name Font",
    "preview.settings.metadataTitleSize": "Preset Name Size",
    "preview.settings.metadataDescription": "Short Description Color",
    "preview.settings.metadataDescriptionFont": "Short Description Font",
    "preview.settings.metadataDescriptionSize": "Short Description Size",
    "preview.settings.axisColorA": "a-Axis Color",
    "preview.settings.axisColorA1": "a1-Axis Color",
    "preview.settings.axisColorB": "b-Axis Color",
    "preview.settings.axisColorA2": "a2-Axis Color",
    "preview.settings.axisColorA3": "a3-Axis Color",
    "preview.settings.axisColorC": "c-Axis Color",
    "preview.settings.axisWidthInner": "Axis Line Width (Inner)",
    "preview.settings.axisWidthOuter": "Axis Line Width (Outer)",
    "preview.settings.ridgeColor": "Ridge Line Color",
    "preview.settings.ridgeWidth": "Ridge Line Width",
    "preview.settings.ridgeOpacity": "Ridge Line Opacity",
    "preview.settings.intersectionColor": "Intersection Line Color",
    "preview.settings.intersectionWidth": "Intersection Line Width",
    "preview.settings.intersectionOpacity": "Intersection Line Opacity",
    "preview.advancedSettingsTitle": "Advanced Settings (beta)",
    "preview.settings.resetBasicToDefault":
      "Reset preview detail settings to defaults",
    "preview.settings.resetAdvancedToDefault":
      "Reset advanced settings to defaults",
    "preview.settings.customProfileDescription":
      "Edits here take effect when Custom is selected.",
    "preview.settings.customFaceTitle": "Face Profile",
    "preview.settings.customLineTitle": "Line Profile",
    "preview.settings.custom.surfaceStyle": "surfaceStyle",
    "preview.settings.custom.materialKind": "materialKind",
    "preview.settings.custom.baseColorMode": "baseColorMode",
    "preview.settings.custom.usesLighting": "usesLighting",
    "preview.settings.custom.usesScreenSpaceFaceOverlay":
      "usesScreenSpaceFaceOverlay",
    "preview.settings.custom.opacityWhenHasFinal": "opacityWhenHasFinal",
    "preview.settings.custom.opacityWhenNoFinal": "opacityWhenNoFinal",
    "preview.settings.custom.depthWrite": "depthWrite",
    "preview.settings.custom.usePolygonOffset": "usePolygonOffset",
    "preview.settings.custom.polygonOffsetFactor": "polygonOffsetFactor",
    "preview.settings.custom.polygonOffsetUnits": "polygonOffsetUnits",
    "preview.settings.custom.useVertexColorsOnMergedGeometry":
      "useVertexColorsOnMergedGeometry",
    "preview.settings.custom.componentBuildMode": "componentBuildMode",
    "preview.settings.custom.preferFinalMergedGeometry":
      "preferFinalMergedGeometry",
    "preview.settings.custom.allowSharedSolidFaceColorMap":
      "allowSharedSolidFaceColorMap",
    "preview.settings.custom.allowSharedSolidFaceOverlay":
      "allowSharedSolidFaceOverlay",
    "preview.settings.custom.usesFaceGroupPalette": "usesFaceGroupPalette",
    "preview.settings.custom.groupedFaceComponentOpacity":
      "groupedFaceComponentOpacity",
    "preview.settings.custom.useLayeredLines": "useLayeredLines",
    "preview.settings.custom.useDepthMask": "useDepthMask",
    "preview.settings.custom.useScreenSpaceLineOverlay":
      "useScreenSpaceLineOverlay",
    "preview.settings.custom.showFrontLines": "showFrontLines",
    "preview.settings.custom.showHiddenSurfaceLines": "showHiddenSurfaceLines",
    "preview.settings.custom.showOccludedInteriorLines":
      "showOccludedInteriorLines",
    "preview.settings.custom.hiddenSurfaceLineColorMode":
      "hiddenSurfaceLineColorMode",
    "preview.settings.custom.hiddenSurfaceLineCustomColor":
      "hiddenSurfaceLineCustomColor",
    "preview.settings.custom.hiddenSurfaceLineOpacityScale":
      "hiddenSurfaceLineOpacityScale",
    "preview.settings.custom.hiddenSurfaceLineWidthScale":
      "hiddenSurfaceLineWidthScale",
    "preview.settings.custom.occludedInteriorLineColorMode":
      "occludedInteriorLineColorMode",
    "preview.settings.custom.occludedInteriorLineCustomColor":
      "occludedInteriorLineCustomColor",
    "preview.settings.custom.occludedInteriorLineOpacityScale":
      "occludedInteriorLineOpacityScale",
    "preview.settings.custom.occludedInteriorLineWidthScale":
      "occludedInteriorLineWidthScale",
    "preview.settings.custom.resolutionMode": "resolutionMode",
    "preview.settings.custom.depthMaskOffsetFactor": "depthMaskOffsetFactor",
    "preview.settings.custom.depthMaskOffsetUnits": "depthMaskOffsetUnits",
    "preview.settings.debugTitle": "Debug",
    "preview.settings.debugDescription":
      "Save the current settings together with preview/xray debug information as one JSON file.",
    "preview.settings.downloadDebugSnapshot": "Save Debug Snapshot",
    "editor.faceListTitle": "Face List",
    "faceText.content": "Engraved Text",
    "faceText.toggleOpen": "Text",
    "faceText.toggleClose": "Close",
    "faceText.font": "Font",
    "faceText.fontSize": "Text Size (mm)",
    "faceText.depth": "Depth (mm)",
    "faceText.offsetU": "Horizontal Position",
    "faceText.offsetV": "Vertical Position",
    "faceText.rotation": "Rotation Angle (deg)",
    "editor.faceTarget": "Face List Edit Target",
    "crystals.add": "Add Crystal",
    "crystals.first": "Crystal 1",
    "crystals.indexed": "Crystal {index}",
    "crystals.firstShort": "C1",
    "crystals.indexedShort": "C{index}",
    "crystals.duplicate": "Duplicate Crystal",
    "crystals.changeColor": "Change Color",
    "crystals.colorLabel": "Color",
    "crystals.delete": "Delete Crystal",
    "crystals.tabMenuAria": "Actions for {label}",
    "validation.validInput":
      "The current input is valid under the current conditions.",
    "export.failed.svg": "Failed to export SVG: {message}",
    "export.failed.png": "Failed to export PNG: {message}",
    "export.failed.jpeg": "Failed to export JPEG: {message}",
    "export.error.exportCanvas": "Failed to create an export canvas.",
    "export.error.pngBlob": "Failed to create a PNG blob.",
    "export.error.jpegBlob": "Failed to create a JPEG blob.",
    "export.error.splitPlaneInvalid":
      "A valid normal could not be computed from the split-plane indices.",
    "export.error.splitStlPlane": "Failed to export split STL: {message}",
    "crystals.deleteConfirm": "Delete this crystal?",
    "faces.clearConfirm": "Delete all faces?",
    "twin.settingsNote.base":
      "No twin law is configured for Crystal 1. Select a derived crystal tab to edit the source crystal, twin type, and twin law for that crystal.",
    "twin.settingsNote.derived": "Configure the twin law for {label}.",
    "faceList.faceLabel": "Face {index} ({faceIndexText})",
    "faceList.showFaceTitle": "Show Face",
    "preset.custom.label": "Custom Input",
    "preset.custom.description": "Keep the current manual input.",
    "system.cubic": "Cubic",
    "system.tetragonal": "Tetragonal",
    "system.orthorhombic": "Orthorhombic",
    "system.hexagonal": "Hexagonal",
    "system.trigonal": "Trigonal",
    "system.monoclinic": "Monoclinic",
    "system.triclinic": "Triclinic",
    "geometry.warning.minEdge":
      "The minimum ridge length is only {value} mm, which may be too short to fabricate as a thin line.",
    "geometry.warning.minInradius":
      "The minimum in-face radius is only {value} mm, which may cause insufficient thickness.",
    "geometry.warning.slender":
      "The model aspect ratio is {value}, which may make it too slender and unstable during fabrication.",
    "geometry.error.axisPositive":
      "Axis length {axisName} must be a positive number.",
    "geometry.error.angleRange":
      "Angle {angleName} must be greater than 0 and less than 180.",
    "geometry.error.modelSize": "Model size must be a positive number.",
    "geometry.error.invalidAxisAngles":
      "The combination of axis angles is geometrically invalid.",
    "geometry.error.faceDistance":
      "Face {index} distance must be a finite number.",
    "geometry.error.faceIndexNumeric":
      "Face {index} Miller indices must be numeric.",
    "geometry.error.faceIndexINumeric": "Face {index} i index must be numeric.",
    "geometry.error.faceZeroIndex":
      "Face {index} Miller indices cannot all be 0,0,0.",
    "geometry.error.faceFourAxisRule":
      "Face {index} must satisfy h + k + i = 0 for hexagonal/trigonal systems.",
    "geometry.warning.closedSolidNeedsFaces":
      "A closed solid typically requires at least 4 faces.",
    "geometry.warning.faceNormalIgnored":
      "Face {index} was ignored because its normal could not be calculated.",
    "geometry.faceLabel": "Face {index}",
    "geometry.error.notEnoughFaces":
      "There are not enough valid faces to generate a closed solid.",
    "geometry.error.cannotBuildClosedSolid":
      "A closed solid could not be generated from the current face combination.",
    "geometry.error.cannotBuildPolygons":
      "Not enough valid face polygons could be constructed.",
    "builder.unionDiagnostic": "[Union Diagnostic] {message}",
    "builder.error.invalidAxisVector":
      "A valid direction vector could not be computed from the twin axis.",
    "builder.error.invalidPlaneNormal":
      "A valid normal could not be computed from the twin plane.",
    "builder.error.ruleMatrixFailed":
      "Failed to build the twin-law transformation matrix: {message}",
    "builder.error.contactFaceMissing":
      "The contact face specified for contact twin of Crystal {index} could not be found as a surface face.",
    "builder.error.contactFaceTracking":
      "The contact face could not be tracked while placing the contact twin for Crystal {index}.",
    "builder.warning.contactAlignFallback":
      "Normal alignment for the contact face of Crystal {index} was incomplete. A fallback placement based on matching centroids was applied.",
    "builder.warning.contactCentroidFallback":
      "A fallback placement based on matching centroids was applied to the contact twin of Crystal {index}.",
    "builder.error.crystalBuildFailed":
      "Failed to build solid geometry for Crystal {index}.",
    "builder.warning.parentMissing":
      "Crystal {index} was removed from display because its source Crystal {parentIndex} could not be resolved.",
    "builder.warning.parentDisabled":
      "Crystal {index} was excluded from union because its source Crystal {parentIndex} is disabled.",
    "builder.error.csgAborted":
      "Aborted before CSG execution. validPlacedBuilds={validPlacedBuilds}, validation.errors={validationErrors}",
    "builder.warning.partialCrystalDisplay":
      "Some crystals could not produce closed solids, so only valid crystals are displayed.",
    "builder.unionDiagnosticException": "CSG exception: {message}",
    "builder.warning.unionFallback":
      "Twin union failed, so the valid crystals before union will be displayed and exported as they are: {message}",
  },
};

let currentLocale = resolveInitialLocale();
const listeners = new Set<(locale: SupportedLocale) => void>();

/**
 * 初期ロケールを決める。
 *
 * 決定順:
 * 1. localStorage に保存済みの明示選択
 * 2. ブラウザの優先言語 (`navigator.languages` / `navigator.language`)
 * 3. 上記で判定できない場合は日本語
 */
function resolveInitialLocale(): SupportedLocale {
  const stored =
    typeof localStorage !== "undefined"
      ? (localStorage.getItem(LOCALE_STORAGE_KEY) ??
        localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY))
      : null;
  if (SUPPORTED_LOCALES.includes(stored)) {
    return stored;
  }
  const browserLanguages =
    typeof navigator !== "undefined"
      ? Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language]
      : [];
  const normalizedBrowserLanguage = browserLanguages
    .filter((languageTag) => typeof languageTag === "string")
    .map((languageTag) => languageTag.toLowerCase())
    .find((languageTag) =>
      SUPPORTED_LOCALES.some(
        (locale) =>
          languageTag === locale || languageTag.startsWith(`${locale}-`),
      ),
    );
  if (normalizedBrowserLanguage?.startsWith("ja")) {
    return "ja";
  }
  if (normalizedBrowserLanguage?.startsWith("en")) {
    return "en";
  }
  return "ja";
}

/** `{label}` 形式のプレースホルダーを実際の値で置換する。 */
function interpolate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    values[key] == null ? "" : String(values[key]),
  );
}

/** `<html lang>` を現在言語へ合わせ、読み上げや検索補助へ反映する。 */
function updateDocumentLanguage(locale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

/** 現在の UI ロケールを返す。 */
export function getCurrentLocale() {
  return currentLocale;
}

/**
 * UI ロケールを切り替え、永続化し、購読者へ通知する。
 *
 * 副作用:
 * - localStorage 更新
 * - `<html lang>` 更新
 * - locale change listener 呼び出し
 */
export function setCurrentLocale(locale: SupportedLocale) {
  if (!SUPPORTED_LOCALES.includes(locale) || locale === currentLocale) {
    return;
  }
  currentLocale = locale;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
  }
  updateDocumentLanguage(locale);
  listeners.forEach((listener) => listener(locale));
}

/** 初回起動時に document 側の言語状態だけを同期する。 */
export function initializeLocale() {
  updateDocumentLanguage(currentLocale);
  return currentLocale;
}

/** ロケール変更購読を登録し、解除関数を返す。 */
export function onLocaleChange(listener: (locale: SupportedLocale) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 翻訳キーと補間値から現在言語の文言を返す。 */
export function t(key, values = {}, locale = currentLocale) {
  const table = translations[locale] ?? translations.ja;
  const fallbackTable = translations.ja;
  const template = table[key] ?? fallbackTable[key] ?? key;
  return interpolate(template, values);
}

/**
 * `data-i18n*` 属性を持つ DOM に対して翻訳文言を流し込む。
 *
 * DOM 構造との対応が重要な箇所で、HTML 側の属性名変更時はこの関数の対象セレクタも要確認。
 */
export function applyTranslations(
  root: ParentNode & {
    querySelectorAll?: typeof document.querySelectorAll;
  } = document,
  locale = currentLocale,
) {
  if (!root?.querySelectorAll) {
    return;
  }

  root.querySelectorAll("[data-i18n]").forEach((element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.textContent = t(htmlElement.dataset.i18n, {}, locale);
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const htmlElement = element as HTMLElement;
    element.setAttribute(
      "placeholder",
      t(htmlElement.dataset.i18nPlaceholder, {}, locale),
    );
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const htmlElement = element as HTMLElement;
    element.setAttribute(
      "aria-label",
      t(htmlElement.dataset.i18nAriaLabel, {}, locale),
    );
  });
  root.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const htmlElement = element as HTMLElement;
    element.setAttribute("title", t(htmlElement.dataset.i18nTitle, {}, locale));
  });
}

/**
 * ヘッダーの言語 select を現在ロケールへ同期し、変更イベントを配線する。
 *
 * select の option 文言自体も現在言語で再生成するため、locale change を購読している。
 */
export function setupLocaleSelect(selectElement) {
  if (!selectElement) {
    return;
  }

  function renderLocaleOptions(locale = currentLocale) {
    const fragment = document.createDocumentFragment();
    SUPPORTED_LOCALES.forEach((candidate) => {
      const option = document.createElement("option");
      option.value = candidate;
      option.textContent = t(`common.locale.${candidate}`, {}, locale);
      fragment.append(option);
    });
    selectElement.replaceChildren(fragment);
  }

  renderLocaleOptions();
  selectElement.value = currentLocale;
  selectElement.addEventListener("change", () => {
    setCurrentLocale(selectElement.value);
  });
  onLocaleChange((locale) => {
    renderLocaleOptions(locale);
    selectElement.value = locale;
  });
}
