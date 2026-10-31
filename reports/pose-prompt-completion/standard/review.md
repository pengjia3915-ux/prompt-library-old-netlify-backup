# standard 分片图片复核

已使用 view_image 实际查看全部 12 张联系图；每张均核对四组及现有五视角。仅写动作、朝向、支撑与可见遮挡，不根据标题补造接触点。

## 已查看的联系图与模糊点

- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-01.jpg`
  - 组：全身单人・标准系:P008、全身单人・标准系:P009、全身单人・标准系:P011、全身单人・标准系:P013。
  - 复核：P008 标题称单膝，五图实际均为双膝屈起；侧面原图确认双脚落地、双手在头后，不写单膝。P009 标题称肘部支撑，图中是手掌撑地。P011 前伸腿仍有屈膝，不写完全伸直。P013 足底与膝部互有遮挡，未补写看不见的手指接触细节。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-02.jpg`
  - 组：全身单人・标准系:P014、全身单人・标准系:P022、全身单人・标准系:P024、全身单人・标准系:P026。
  - 复核：P014 握踝手在侧面与小腿重叠，不细分手指；P022 双臂幅度较小，按向侧后方下伸描述；P024 后抬脚有遮挡，未猜左右；P026 仅写一侧承重与扶腰，不指定解剖左右。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-03.jpg`
  - 组：全身单人・标准系:P027、全身单人・标准系:P029、全身单人・标准系:P030、全身单人・标准系:P032。
  - 复核：P027、P029 头后手指被头部遮挡，不写相扣；P030 侧面可见脚跟抬起；P032 双膝跪地、小腿后折，未套用站姿。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-04.jpg`
  - 组：全身单人・标准系:P034、全身单人・标准系:P035、全身单人・标准系:P036、全身单人・标准系:P037。
  - 复核：P034 后仰程度在俯视下不突出，视角句只写可见轮廓；P035 手掌相向但没有合掌；P036 扶腰手在侧面部分遮挡；P037 是一膝一脚支撑，未把立起腿写成跪地。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-05.jpg`
  - 组：全身单人・标准系:P038、全身单人・标准系:P039、全身单人・标准系:P040、全身单人・标准系:P042。
  - 复核：P038 侧面抬臂与正面投影方向不同，按当前图写；P039 腰后双手在侧面重叠；P040 低位手位于大腿，不写成扶腰；P042 双脚向外后折，掌在膝前支地。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-06.jpg`
  - 组：全身单人・标准系:P043、全身单人・标准系:P044、全身单人・标准系:P046、全身单人・标准系:P047。
  - 复核：P043 双膝靠拢、双脚外分，区别于高位跪立；P044 后撑掌和躯干后仰清楚；P046 双腿侧叠、手贴脸侧，不猜具体指尖；P047 上举手和双脚在低角度有缩短。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-07.jpg`
  - 组：全身单人・标准系:P048、全身单人・标准系:P051、全身单人・标准系:P052、全身单人・标准系:P054。
  - 复核：P048 侧面手触下颌与颈侧交界，未把标题当成精确接触点；P051 前臂支地、双膝屈起；P052 侧面躯干平躺，其他图上躯干透视不同，分别写；P054 俯视下侧臂向前展开，与其他角度屈臂轮廓有差异，保留该图。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-08.jpg`
  - 组：全身单人・标准系:P056、全身单人・标准系:P057、全身单人・标准系:P058、全身单人・标准系:P059。
  - 复核：P056 侧面原图明显呈俯伏、头侧向下，与仰卧标题及其他图有生成差异；已单独描述，不强行统一。P057 双腿基本伸直、双脚侧叠；P058 双前臂交叠，不推断掌指相扣；P059 侧面原图躯干和头部贴地，其他角度上躯干抬起，按图分写。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-09.jpg`
  - 组：全身单人・标准系:P062、全身单人・标准系:P063、全身单人・标准系:P064、全身单人・标准系:P065。
  - 复核：P062 侧面脚跟抬起而正面不明显，仅在清楚视角说明；P063 托下颌肘靠膝；P064 手放头后，不描写不存在的发丝；P065 双掌支地且侧面踮脚明确。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-10.jpg`
  - 组：全身单人・标准系:P066、全身单人・标准系:P068、全身单人・标准系:P069、全身单人・标准系:P070。
  - 复核：P066 正低角度头部转向投影有差异，各图独立描述、不猜左右；P068 低角度前折看起来较小，未统一成直立；P069 一手扶腰另一手在膝上；P070 双手都扶大腿下段，侧面骨盆后移清楚。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-11.jpg`
  - 组：全身单人・标准系:P071、全身单人・标准系:P072、全身单人・标准系:P073、全身单人・标准系:P074。
  - 复核：P071 双手悬空，不写触地；P072 后抬腿侧面有轻微屈膝，不写锁直；P073 双手扶腰；P074 放大侧面原图确认双膝小腿与后侧手掌支撑，远侧臂被躯干挡住，不补其指尖。
- `D:\Codex\Prompt-Library\prompt-library-3.0-local\designs\prompt-library-v4\app\reports\pose-prompt-completion\standard\sheet-12.jpg`
  - 组：全身单人・标准系:P075、全身单人・标准系:P077、全身单人・标准系:P078、全身单人・标准系:P079。
  - 复核：P075 双臂展开成V形，侧面重叠；P077 双臂在侧面向前后展开，不套用双臂均朝镜头；P078 侧面坐部更低、接近脚跟，保留差异；P079 膝部轻屈，双脚并拢前伸，手部不确定左右。

## 放大查看的原图

- `data/pose-reference/img/full_single_P008_side.png`：使用 view_image 查看原图，结论见对应联系图记录。
- `data/pose-reference/img/full_single_P056_side.png`：使用 view_image 查看原图，结论见对应联系图记录。
- `data/pose-reference/img/full_single_P059_side.png`：使用 view_image 查看原图，结论见对应联系图记录。
- `data/pose-reference/img/full_single_P074_side.png`：使用 view_image 查看原图，结论见对应联系图记录。

## 输出验证

- manifest 48 组，结果 48 组；组 key 集合完全一致。
- manifest 240 个现有视角，结果 240 个；逐组 view id 集合完全一致，无新增或遗漏。
- 所有条目 review 均为 reference-checked，generationTested 均为 false；未进行生图测试。
- 仅写本目录 entries.json 与 review.md；未修改 catalog 或已有正文，未部署、未推送。
