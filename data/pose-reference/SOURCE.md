# 来源与授权依据
原作者：ギア（@giaaibusi），https://x.com/giaaibusi 。原站：https://ai-pose-gallery.pages.dev/ 。
中文元数据来源：https://github.com/anhao/ai-pose-gallery-zh ，主分支，下载日期2026-10-30。
首版只展示全身单人标准系：73组、365视角。源数据未转换成新的Prompt。
用户提供原作者公开说明截图，声明免费、可商用、可编辑二创，需标明来源；截图保存在author-permission-user-supplied.png。截图为用户提供，本轮未单独核实原帖URL。
镜像仓库自身MIT范围声明见UPSTREAM-LICENSE.txt；不将代码许可扩大解释为图片许可。
收藏使用独立localStorage key prompt-library-pose-reference-v1，支持本区导入/导出，暂不混入旧云同步或状元/榜眼状态。

## 本地扩充（未部署）
本地选集扩至187组935视角，137组全身单人、42组上半身、8组双人互动。新增候选逐组核对了五视角缩略图，筛选决策留在reports/pose-screening；未收录的原图不放入客户端。原25组动作词保留，新增条目不自动扩写。

## 逐图复核修订（仅本地）
上轮未收录101组，本轮核对其504张已有视角缩略图，补回64组。当前合计251组1254视角：全身单人153、上半身80、双人18。单人三个原体系已全部保留；37组双人条目未收录，明确性行为、性化接触和不能确认的情况在reports/pose-recheck/decisions.json分别记录。P026/P043保留并附原图备注，不作为内容禁区。


## 2026-10-31 本地中文动作词补齐
在保留原25组正文的基础上，对照新增226组1129个视角图片整理中文动作词；当前251组1254视角均有正文。新动作词为项目内整理，不是上游原作者提供的文本。已核对参考图，未实测生成。此变更仅在本地，尚未部署。详见reports/pose-prompt-completion/README.md。
