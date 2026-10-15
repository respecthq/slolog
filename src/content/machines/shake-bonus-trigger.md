---
name: ＳＨＡＫＥ ＢＯＮＵＳ ＴＲＩＧＧＥＲ
maker: '大都技研'
ceiling: ''
noCeiling: true
junzo: ''
zone: ''
released: 2025-10
koyaku: ''
payout: '98.6%〜108.1%'
bonus: '1/192.2〜1/148.9'
source: https://www.daitogiken.com/contents/product/slot/shakeb/
fetched: 2026-09-04
added: 2026-09-04
crosscheckUrl: https://p.hisshobon.jp/machine/4624
draft: false
gen: 'スマスロ'
modelName: 'LB／シェイクボーナストリガー／A1'
modelNameSource: https://www.p-world.co.jp/machine/database/10361
kenteiNo: '530293'
image:
  src: images/machines/shake-bonus-trigger-kyoutai.png
  alt: ＳＨＡＫＥ ＢＯＮＵＳ ＴＲＩＧＧＥＲ の筐体
  placement: above
  credit: ©DAITO GIKEN,INC.
updated: 2026-10-16
updateNote: 小役カウンタのベル・スイカをA・B合算と明記
reels:
  src: images/machines/shake-bonus-trigger-reel.png
  credit: ©DAITO GIKEN,INC.
counter: # 機種専用の小役カウンタ（設定判別）：unchecked 未確認／none 対象外／bonus BIG・REGだけ／detail 小役も数える
  status: detail
  date: 2026-10-16
  checked:
    - https://1geki.jp/slot/lb_shake/99/
    - https://kenslo65536.com/hanbetsu/lb-shake.html
    - https://1geki.jp/slot/lb_shake/0/
  note: '公表値（設定1・2・5・6）でBIG・REGを推測。一撃の通常時小役はベル・スイカともA・B合算。旧bell・suikaで登録した確率を黙って読み替えないよう合算のkindを新設。重複3項目とBT中JACは1.2.1以降で扱いを整理'
  count: '通常時だけを数えます（BT中・ボーナス消化中は除く）。ベル・スイカはA・B合算で数え、設定別の確率も通常時の合算値を入力してください。'
  roles:
    - { name: BIG, kind: big_total, group: bonus }
    - { name: REG, kind: reg_total, group: bonus }
    - { name: ベル, kind: bell_ab, group: koyaku }
    - { name: チェリー, kind: cherry_total, group: koyaku }
    - { name: スイカ, kind: suika_ab, group: koyaku }
---


<!-- spec:begin -->

## 設定別スペック

| 設定 | BB確率 | RB確率 | 合算 | 出玉率 |
|---:|---:|---:|---:|---:|
| 1 | 1/350.5 | 1/425.6 | 1/192.2 | 98.6%〜100.4% |
| 2 | 1/327.7 | 1/332.7 | 1/165.1 | 100.6%〜102.4% |
| 5 | 1/341.3 | 1/409.6 | 1/186.2 | 103.0%〜104.9% |
| 6 | 1/297.9 | 1/297.9 | 1/148.9 | 106.1%〜108.1% |

メーカー公式が公表しているシミュレーション値です。メーカーが公表しているのは設定1・2・5・6のみ。

<!-- spec:end -->
