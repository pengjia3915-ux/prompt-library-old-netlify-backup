// Curated browsing notes only; never persisted as prompt/description/tags.
const group = (id, title, basis, suite, kind, members) => ({id,title,basis,members:members.map(([id,difference])=>({key:`${suite}:${kind}:${id}`,difference}))});
export const FAMILIES = [
  group('floor-support','坐地后撑','同为坐地后撑，比较腿部、手部与环境。','bangyan','direct',[
    ['direct_bold_pose_03','地毯；双腿前展；双手撑地、抬头看镜头'],
    ['direct_bold_pose_27','工作室地面；双腿打开；双手在身后支撑'],
    ['direct_bold_pose_18','落地窗地板；双腿向两侧展开；一手拨发'],
    ['direct_bold_pose_15','地板靠沙发；双膝弯曲外展；双手后撑']]),
  group('bed-support','床边与床面后撑','同为床上后撑，腿部和手部动作不同。','bangyan','direct',[
    ['direct_bold_pose_06','床中央；一腿屈起踩床，另一腿伸展'],
    ['direct_bold_pose_13','床边；双腿分开前伸；整理头发、看镜头']]),
  group('sofa-recline','沙发侧靠与屈腿','同为沙发侧靠，半躺与坐姿不同。','bangyan','direct',[
    ['direct_bold_pose_02','半躺侧靠；一腿屈起，另一腿伸展；轻松笑意'],
    ['direct_bold_pose_04','屈膝坐姿；另一腿落下；侧靠扶手、拨发']]),
  group('library-reading','图书馆阅读写真','阅读靠椅与格纹短裙相近，领口和袜型不同。','bangyan','direct',[
    ['direct_fullbody_18','方领针织衫；深色长筒丝袜；靠椅持书'],
    ['direct_fullbody_25','心形领针织衫；裸色丝袜；暖色室内光']]),
  group('elevator-lean','电梯厅靠墙写真','同为电梯厅靠墙与裸色丝袜，场所和上衣不同。','bangyan','direct',[
    ['direct_fullbody_04','写字楼；不对称单肩上衣、A字短裙'],
    ['direct_fullbody_19','酒店；修身上衣、短裙；2K摄影质感']]),
  group('gym-outfit','健身房运动穿搭写真','运动上衣与运动丝袜相近，姿势与道具不同。','bangyan','direct',[
    ['direct_fullbody_06','镜旁站立；运动短裙；整理头发'],
    ['direct_fullbody_23','休息椅坐姿；短裙或短裤；手拿毛巾']]),
  group('sofa-fullbody','沙发侧坐全身写真','均为沙发边缘侧坐，服装限制和腿部细节不同。','bangyan','direct',[
    ['direct_fullbody_10','客厅针织套装、深灰丝袜；双脚落地'],
    ['direct_fullbody_pose_04','针织套装或连衣裙；双腿向同一侧摆放']]),
  group('v-top-skirt','深V上衣与短裙','共用清理遮挡与画质要求，上衣结构不同。','zhuangyuan','prompt',[
    ['default-005','宽松透气无袖上衣、略露肩；高腰短裙'],
    ['default-034','宽松轻薄罩衫式上衣；超短裙；腿部可微屈']]),
  group('one-knee','单膝低姿态','同为单膝低位，注意膝盖是否接触地面。','bangyan','component',[
    ['pose_33','一侧膝盖明确着地，另一腿向前支撑'],
    ['pose_48','一侧膝盖接近地面，另一侧脚掌支撑']]),
  group('focused-expression','收敛与专注表情','都闭嘴，眉眼情绪方向不同。','bangyan','component',[
    ['expr_06','若有所思；眉眼轻微收敛'],
    ['expr_15','专注凝视；眉眼集中但不紧绷']]),
  group('white-socks-outfit','白色过膝袜与短裙','完整穿搭方案；上衣细节与裙装不同。','bangyan','direct',[
    ['direct_stockings_outfit_04','方领针织上衣、百褶短裙；白色过膝针织袜'],
    ['direct_stockings_outfit_15','蕾丝边上衣、针织短裙；白色过膝袜']]),
  group('wine-socks-outfit','酒红袜与设计感上衣','完整穿搭方案；袜长、上衣和下装不同。','bangyan','direct',[
    ['direct_stockings_outfit_05','裹身深V上衣、简洁短裙；酒红色丝袜'],
    ['direct_stockings_outfit_12','露背上衣、A字短裙；酒红色长筒袜']]),
  group('mesh-socks-outfit','细网袜穿搭','同为细网袜搭配，服装材质与裙裤不同。','bangyan','direct',[
    ['direct_stockings_outfit_06','露肩修身针织套装；细密黑色网纹丝袜'],
    ['direct_stockings_outfit_11','针织背心、牛仔短裙、肩披外套；细网丝袜'],
    ['direct_stockings_outfit_16','斜肩针织上衣、高腰短裤；黑色细鱼网袜']]),
  group('sock-material','膝上袜材质与配色','袜型调整方案；比较颜色、织纹和袜口。','bangyan','direct',[
    ['direct_pure_socks_01','黑色膝上长筒袜；袜口在大腿中上部'],
    ['direct_pure_socks_02','白色膝上针织长筒袜；平整袜口'],
    ['direct_pure_socks_03','深灰过膝针织袜；柔软织纹、自然褶皱'],
    ['direct_pure_socks_07','白色膝上运动袜；袜口两条横纹'],
    ['direct_pure_socks_12','深色长筒袜；袜口低调撞色条纹']]),
  group('short-socks','中短袜长度与材质','袜型调整方案；袜口高度与透肤程度不同。','bangyan','direct',[
    ['direct_pure_socks_09','小腿上部袜口；针织材质，可有细条纹'],
    ['direct_pure_socks_10','低位踝袜；简洁白色短袜'],
    ['direct_pure_socks_11','小腿中部袜口；半透黑色中筒袜']])
];
const byKey = new Map(FAMILIES.flatMap(f=>f.members.map(m=>[m.key,{...m,family:f}])));
export function familyFor(suite,kind,entry,edited=false) {
  return edited ? null : byKey.get(`${suite}:${kind}:${entry.id}`) || null;
}
// Filter first, group second. A group never imports hidden/unmatched siblings.
export function familyUnits(items, getFamily) {
  const result=[], groups=new Map();
  for(const item of items) {
    const member=getFamily(item);
    if(!member) {result.push({items:[item]});continue;}
    let unit=groups.get(member.family.id);
    if(!unit) {unit={family:member.family,items:[]};groups.set(member.family.id,unit);result.push(unit);}
    unit.items.push(item);
  }
  return result;
}
