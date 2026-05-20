export interface NavLevelInfo {
  current_level: number
  current_min: number
  current_exp: number
  next_exp: number | '--'
}

export interface NavOfficial {
  role: number
  title: string
  desc: string
  type: -1 | 0 | number
}

export interface NavOfficialVerify {
  type: -1 | 0 | number
  desc: string
}

export interface NavPendant {
  pid: number
  name: string
  image: string
  expire: number
  image_enhance?: string
  image_enhance_frame?: string
}

export interface NavVipLabel {
  path: string
  text: string
  label_theme: 'vip' | 'annual_vip' | 'ten_annual_vip' | 'hundred_annual_vip' | string
  text_color?: string
  bg_style?: number
  bg_color?: string
  border_color?: string
  use_img_label?: boolean
  img_label_uri_hans?: string
  img_label_uri_hant?: string
  img_label_uri_hans_static?: string
  img_label_uri_hant_static?: string
}

export interface NavVip {
  type: 0 | 1 | 2 | number
  status: 0 | 1 | number
  due_date: number
  vip_pay_type: 0 | 1 | number
  theme_type: number
  label: NavVipLabel
  avatar_subscript: 0 | 1 | number
  nickname_color: string
  role?: number
  avatar_subscript_url?: string
  tv_vip_status?: number
  tv_vip_pay_type?: number
  tv_due_date?: number
}

export interface NavWallet {
  mid: number
  bcoin_balance: number
  coupon_balance: number
  coupon_due_time: number
}

export interface NavWbiImg {
  img_url: string
  sub_url: string
}

export interface NavData {
  isLogin: boolean
  email_verified: 0 | 1 | number
  face: string
  face_nft?: number
  face_nft_type?: number
  level_info: NavLevelInfo
  mid: number
  mobile_verified: 0 | 1 | number
  money: number
  moral: number
  official: NavOfficial
  officialVerify: NavOfficialVerify
  pendant: NavPendant
  scores: number
  uname: string
  vipDueDate: number
  vipStatus: 0 | 1 | number
  vipType: 0 | 1 | 2 | number
  vip_pay_type: 0 | 1 | number
  vip_theme_type: number
  vip_label: NavVipLabel
  vip_avatar_subscript: 0 | 1 | number
  vip_nickname_color: string
  vip?: NavVip
  wallet: NavWallet
  has_shop: boolean
  shop_url: string
  allowance_count: number
  answer_status: number
  is_senior_member: 0 | 1 | number
  wbi_img: NavWbiImg
  is_jury: boolean
}
