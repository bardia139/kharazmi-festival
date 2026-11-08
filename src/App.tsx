import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase, configured } from './supabase'
import type { Category, Registration } from './types'
import {
  GraduationCap, ShieldCheck, Users, Layers3, Search, Download, Printer,
  LogOut, LockKeyhole, Phone, RefreshCw, Plus, Pencil, Trash2, X, ChartNoAxesColumn,
  Database, Settings, CheckCircle2, AlertCircle, Menu, ArrowRightLeft, KeyRound
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import * as XLSX from 'xlsx'

const initialCategories = [
 'قرآن و معارف اسلامی','پژوهش','زبان و ادبیات فارسی','فرهنگ و هنر','سلامت و تربیت بدنی',
 'دست‌سازه','بازارچه کسب‌وکار دانش‌آموزی','برنامه‌نویسی','مناظره مطالعات اجتماعی',
 'ریاضی','فعالیت‌های آزمایشگاهی','زبان انگلیسی','بازی‌های مهارتی و توسعه فردی'
]

function App() {
  const [page, setPage] = useState<'register'|'admin'>('register')
  const [categories, setCategories] = useState<Category[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<{type:'ok'|'error',text:string}|null>(null)
  const [successScreen, setSuccessScreen] = useState(false)
  const [sessionRole, setSessionRole] = useState<'owner'|'admin'|null>(null)
  const [ownerLoginOpen, setOwnerLoginOpen] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState('bardiamohamadi992@gmail.com')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [globalOpen, setGlobalOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [studentName, setStudentName] = useState('')
  const [phone, setPhone] = useState('')
  const [grade, setGrade] = useState('هفتم')
  const [classNumber, setClassNumber] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [editing, setEditing] = useState<Category|null>(null)
  const [catName, setCatName] = useState('')
  const [catCapacity, setCatCapacity] = useState('')
  const [editReg, setEditReg] = useState<Registration|null>(null)
  const [newRegCategory, setNewRegCategory] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)

  const notify = (type:'ok'|'error', text:string) => {
    setNotice({type,text})
    window.setTimeout(() => setNotice(null), 4500)
  }

  async function loadPublicCategories() {
    if (!supabase) return
    const settings = await supabase.from('site_settings').select('registrations_open').eq('singleton',true).single()
    if (!settings.error) setGlobalOpen(settings.data.registrations_open)
    const {data,error} = await supabase.from('categories').select('*').eq('is_open',true).order('sort_order')
    if (error) notify('error','دریافت رشته‌ها ناموفق بود: '+error.message)
    else setCategories((settings.data?.registrations_open ? data : [])||[])
  }
  async function loadAdminData() {
    if (!supabase || !session) return
    setLoading(true)
    const [cats, regs] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('registrations').select('*, categories(name)').order('created_at',{ascending:false})
    ])
    if (cats.error) notify('error','خطا در دریافت رشته‌ها: '+cats.error.message)
    else setCategories((cats.data||[]) as Category[])
    if (regs.error) notify('error','خطا در دریافت ثبت‌نام‌ها: '+regs.error.message)
    else setRegistrations((regs.data||[]) as Registration[])
    setLoading(false)
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s)=>setSession(s))
    return ()=>subscription.unsubscribe()
  },[])
  useEffect(() => { loadPublicCategories() },[])
  useEffect(() => {
    if (!session || !supabase) return
    let cancelled = false
    ;(async () => {
      const owner = await supabase.rpc('is_owner')
      if (cancelled) return
      if (!owner.error && owner.data === true) {
        setSessionRole('owner')
        const settings = await supabase.from('site_settings').select('registrations_open').eq('singleton',true).single()
        if (!settings.error && settings.data) setGlobalOpen(settings.data.registrations_open)
        await loadAdminData()
        return
      }
      const admin = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
      if (cancelled) return
      if (admin.error || !admin.data) {
        await supabase.auth.signOut()
        setSession(null); setSessionRole(null)
        notify('error', 'این حساب مجوز ورود به پنل را ندارد.')
        return
      }
      setSessionRole('admin')
      await loadAdminData()
    })()
    return () => { cancelled = true }
  }, [session?.user?.id])

  const counts = useMemo(() => categories.map(c => ({
    name:c.name.length>18?c.name.slice(0,18)+'…':c.name,
    count:registrations.filter(r=>r.category_id===c.id).length
  })),[categories,registrations])
  const filtered = useMemo(() => registrations.filter(r => {
    const q=search.trim().toLocaleLowerCase('fa')
    const matches = !q || [r.student_name,r.parent_phone,r.class_number,r.grade].some(v=>String(v).toLocaleLowerCase('fa').includes(q))
    return matches && (filter==='all'||r.category_id===filter)
  }),[registrations,search,filter])

  async function submitRegistration(e:FormEvent) {
    e.preventDefault()
    if (studentName.trim().toLowerCase()==='bardiamohamadi992@gmail.com') { setOwnerLoginOpen(true); setOwnerPassword(''); setOwnerEmail('bardiamohamadi992@gmail.com'); return }
    if (!supabase) return notify('error','اتصال پایگاه داده تنظیم نشده است.')
    if (!studentName.trim() || !phone.trim() || !classNumber.trim() || !categoryId) return notify('error','همه فیلدها را تکمیل کنید.')
    if (!/^09\d{9}$/.test(phone.trim())) return notify('error','شماره موبایل والد باید با 09 شروع شود و ۱۱ رقم باشد.')
    setLoading(true)
    const {data,error}=await supabase.rpc('register_student',{
      p_student_name:studentName.trim(),p_parent_phone:phone.trim(),p_grade:grade,
      p_class_number:classNumber.trim(),p_category_id:categoryId
    })
    setLoading(false)
    if(error) return notify('error',error.message)
    setNotice(null)
    setSuccessScreen(true)
    setStudentName('');setPhone('');setClassNumber('');setCategoryId('')
  }

  async function login(e:FormEvent) {
    e.preventDefault()
    if(!supabase) return notify('error','ابتدا تنظیمات Supabase را انجام دهید.')
    setLoading(true)
    const {error}=await supabase.auth.signInWithPassword({email,password})
    setLoading(false)
    if(error) notify('error','ورود ناموفق بود. ایمیل و رمز عبور را بررسی کنید.')
    else {setPassword('');notify('ok','با موفقیت وارد شدید.')}
  }
  async function ownerLogin(e:FormEvent) {
    e.preventDefault()
    if(!supabase) return notify('error','اتصال پایگاه داده تنظیم نشده است.')
    setLoading(true)
    const {error}=await supabase.auth.signInWithPassword({email:'bardiamohamadi992@gmail.com',password:ownerPassword})
    setLoading(false)
    if(error) notify('error','ورود ناموفق بود؛ رمز عبور را بررسی کن.')
    else {setOwnerLoginOpen(false);setOwnerPassword('');notify('ok','در حال بررسی دسترسی صاحب سایت…')}
  }
  async function toggleGlobalRegistration() {
    if(!supabase || sessionRole!=='owner') return
    const next=!globalOpen
    const {error}=await supabase.from('site_settings').update({registrations_open:next,updated_at:new Date().toISOString(),updated_by:session.user.id}).eq('singleton',true)
    if(error) notify('error','تغییر وضعیت انجام نشد: '+error.message)
    else {setGlobalOpen(next);if(next) await loadPublicCategories();else setCategories([]);notify('ok',next?'ثبت‌نام همه رشته‌ها باز شد.':'ثبت‌نام همه رشته‌ها بسته شد.')}
  }
  async function logout() {
    await supabase?.auth.signOut();setSession(null);setSessionRole(null);setPage('register');setOwnerLoginOpen(false);notify('ok','از پنل خارج شدید.')
  }
  async function saveCategory(e:FormEvent) {
    e.preventDefault(); if(!supabase) return
    const payload={name:catName.trim(),capacity:catCapacity?Number(catCapacity):null}
    const result=editing
      ? await supabase.from('categories').update(payload).eq('id',editing.id)
      : await supabase.from('categories').insert({...payload,is_open:true,sort_order:categories.length+1})
    if(result.error) notify('error',result.error.message)
    else {notify('ok','رشته ذخیره شد.');setEditing(null);setCatName('');setCatCapacity('');loadAdminData()}
  }
  async function toggleCategory(c:Category) {
    const {error}=await supabase!.from('categories').update({is_open:!c.is_open}).eq('id',c.id)
    if(error) notify('error',error.message); else loadAdminData()
  }
  async function deleteCategory(c:Category) {
    if(!confirm(`رشته «${c.name}» حذف شود؟ فقط رشته بدون ثبت‌نام قابل حذف است.`)) return
    const {error}=await supabase!.from('categories').delete().eq('id',c.id)
    if(error) notify('error','حذف انجام نشد؛ احتمالاً برای این رشته ثبت‌نام وجود دارد.')
    else {notify('ok','رشته حذف شد.');loadAdminData()}
  }
  async function moveRegistration(e:FormEvent) {
    e.preventDefault(); if(!editReg||!supabase) return
    const {error}=await supabase.from('registrations').update({category_id:newRegCategory}).eq('id',editReg.id)
    if(error) notify('error',error.message)
    else {notify('ok','رشته دانش‌آموز تغییر کرد.');setEditReg(null);loadAdminData()}
  }
  async function deleteRegistration(r:Registration) {
    if(!confirm(`ثبت‌نام ${r.student_name} حذف شود؟`)) return
    const {error}=await supabase!.from('registrations').delete().eq('id',r.id)
    if(error) notify('error',error.message); else {notify('ok','ثبت‌نام حذف شد.');loadAdminData()}
  }
  async function changePassword() {
    const next=prompt('رمز عبور جدید (حداقل ۸ کاراکتر) را وارد کنید:')
    if(!next) return
    if(next.length<8) return notify('error','رمز عبور باید حداقل ۸ کاراکتر باشد.')
    const {error}=await supabase!.auth.updateUser({password:next})
    if(error) notify('error',error.message); else notify('ok','رمز عبور تغییر کرد.')
  }
  function exportExcel() {
    const rows=filtered.map(r=>({'نام و نام خانوادگی':r.student_name,'شماره والد':r.parent_phone,'پایه':r.grade,'کلاس':r.class_number,'رشته':r.categories?.name||'', 'تاریخ ثبت‌نام':new Date(r.created_at).toLocaleString('fa-IR')}))
    const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'ثبت‌نام‌ها');XLSX.writeFile(wb,'kharazmi-registrations.xlsx')
  }
  function backup() {
    const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),categories,registrations},null,2)],{type:'application/json'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='kharazmi-backup.json';a.click();URL.revokeObjectURL(a.href)
  }
  const activeCount=categories.filter(c=>c.is_open).length
  const selectedCategory=categories.find(c=>c.id===categoryId)

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><GraduationCap size={23}/></div><div><strong>خوارزمی</strong><small>جشنواره نوجوانان · متوسطه اول</small></div></div>
      <nav className={mobileMenu?'nav open':'nav'}>
        <button className={page==='register'?'nav-link active':'nav-link'} onClick={()=>{setPage('register');setMobileMenu(false)}}>ثبت‌نام دانش‌آموز</button>
        <button className={page==='admin'?'nav-link active':'nav-link'} onClick={()=>{setPage('admin');setMobileMenu(false)}}>پنل مدیریت</button>
      </nav>
      <button className="icon-btn mobile-toggle" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="منو"><Menu/></button>
      {session && <button className="outline-btn logout-top" onClick={logout}><LogOut size={16}/> خروج</button>}
    </header>

    {!configured && <div className="setup-alert"><AlertCircle size={18}/> اتصال Supabase هنوز تنظیم نشده است. فایل <b>.env.example</b> را طبق راهنمای پروژه تنظیم کنید.</div>}
    {notice && <div className={`toast ${notice.type}`}><span>{notice.type==='ok'?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}</span>{notice.text}<button onClick={()=>setNotice(null)}><X size={16}/></button></div>}

    {session && sessionRole==='owner' ? <main className="owner-main" dir="rtl">
      <div className="owner-layout">
        <aside className="owner-sidebar">
          <div className="owner-brand"><div className="owner-brand-icon"><GraduationCap size={22}/></div><div><b>خوارزمی</b><small>فضای مدیریت مالک</small></div></div>
          <div className="owner-side-label">فضای اختصاصی</div>
          <a className="owner-nav active" href="#overview"><ChartNoAxesColumn size={17}/> نمای کلی</a>
          <a className="owner-nav" href="#controls"><Settings size={17}/> کنترل سامانه</a>
          <a className="owner-nav" href="#tools"><Database size={17}/> ابزارها و داده‌ها</a>
          <div className="owner-sidebar-bottom"><span className="owner-avatar">B</span><div><b>صاحب سایت</b><small>دسترسی اصلی</small></div><button onClick={logout} aria-label="خروج"><LogOut size={17}/></button></div>
        </aside>
        <div className="owner-workspace">
          <header className="owner-header"><div><span className="owner-overline">KHARAZMI / OWNER SPACE</span><h1>داشبورد اختصاصی</h1><p>همه‌چیز برای مدیریت جشنواره، یک‌جا و ساده.</p></div><div className="owner-header-actions"><span className="owner-secure"><ShieldCheck size={15}/> اتصال امن</span><button onClick={loadAdminData} className="owner-refresh"><RefreshCw size={16}/> بروزرسانی</button></div></header>
          <section className="owner-welcome" id="overview"><div className="owner-welcome-copy"><span className="owner-pill"><i/> پنل مالک فعال است</span><h2>سلام، خوش آمدی 👋</h2><p>وضعیت کلی جشنواره و کنترل‌های اصلی از این بخش در دسترس توست.</p></div><div className="owner-welcome-mark"><GraduationCap size={74}/></div></section>
          <section className="owner-stats">
            <article className="owner-stat"><span className="owner-stat-icon blue"><Users size={19}/></span><small>کل ثبت‌نام‌ها</small><strong>{registrations.length.toLocaleString('fa-IR')}</strong><em>شرکت‌کننده ثبت‌شده</em></article>
            <article className="owner-stat"><span className="owner-stat-icon violet"><Layers3 size={19}/></span><small>تعداد محورهای جشنواره</small><strong>{categories.length.toLocaleString('fa-IR')}</strong><em>محور تعریف‌شده</em></article>
            <article className="owner-stat"><span className="owner-stat-icon green"><CheckCircle2 size={19}/></span><small>محورهای فعال</small><strong>{categories.filter(c=>c.is_open).length.toLocaleString('fa-IR')}</strong><em>آماده دریافت ثبت‌نام</em></article>
          </section>
          <section className="owner-control-card" id="controls"><div className="owner-control-top"><div><span className="owner-section-kicker">REGISTRATION CONTROL</span><h2>کنترل ثبت‌نام سراسری</h2><p>با این کلید، ثبت‌نام همه محورهای جشنواره را هم‌زمان مدیریت کن.</p></div><span className={globalOpen?'owner-state-badge live':'owner-state-badge paused'}><i/>{globalOpen?'در حال دریافت ثبت‌نام':'ثبت‌نام متوقف است'}</span></div><div className="owner-control-bottom"><div className="owner-control-explain"><span className={globalOpen?'owner-big-indicator live':'owner-big-indicator paused'}><i/></span><div><b>{globalOpen?'سامانه برای دانش‌آموزان باز است':'سامانه فعلاً بسته است'}</b><small>{globalOpen?'فرم ثبت‌نام در دسترس دانش‌آموزان قرار دارد.':'هیچ ثبت‌نام تازه‌ای پذیرفته نمی‌شود؛ اطلاعات قبلی محفوظ است.'}</small></div></div><button className={globalOpen?'owner-master-button stop':'owner-master-button start'} onClick={toggleGlobalRegistration}>{globalOpen?'توقف ثبت‌نام':'فعال‌سازی ثبت‌نام'} <span>{globalOpen?'Ⅱ':'▶'}</span></button></div><div className="owner-control-note"><LockKeyhole size={14}/> این تغییر فقط با دسترسی صاحب سایت امکان‌پذیر است و روی اطلاعات قبلی اثری ندارد.</div></section>
          <section className="owner-tools-section" id="tools"><div className="owner-tools-heading"><div><span className="owner-section-kicker">QUICK ACTIONS</span><h2>ابزارهای مدیریتی</h2></div><span>دسترسی سریع</span></div><div className="owner-action-grid"><button onClick={exportExcel}><span className="owner-action-icon excel"><Download size={20}/></span><b>دریافت فایل اکسل</b><small>خروجی فهرست ثبت‌نام‌ها</small><span className="owner-action-arrow">←</span></button><button onClick={backup}><span className="owner-action-icon backup"><Database size={20}/></span><b>پشتیبان اطلاعات</b><small>ذخیره نسخه پشتیبان محلی</small><span className="owner-action-arrow">←</span></button><a href="https://github.com/bardia139/kharazmi-festival" target="_blank" rel="noreferrer"><span className="owner-action-icon github">GH</span><b>کدهای پروژه</b><small>مشاهده مخزن GitHub</small><span className="owner-action-arrow">↗</span></a><a href="https://supabase.com/dashboard/project/ljdpnyjftbksernrgahx" target="_blank" rel="noreferrer"><span className="owner-action-icon database"><Settings size={20}/></span><b>پایگاه داده</b><small>ورود به مدیریت Supabase</small><span className="owner-action-arrow">↗</span></a></div></section>
          <footer className="owner-dashboard-footer"><span><ShieldCheck size={15}/> محیط خصوصی صاحب سایت</span><span>KHARAZMI FESTIVAL <i>•</i> OWNER EDITION</span></footer>
        </div>
      </div>
    </main> page==='register' ? <main className="public-main">
      <section className="hero">
        <div className="hero-chip"><span className="pulse"></span> ثبت‌نام جشنواره · متوسطه اول</div>
        <h1>استعدادت را<br/><em>به نمایش بگذار.</em></h1>
        <p>در جشنواره نوجوان خوارزمی شرکت کن و مسیر علاقه‌مندی‌ها و توانایی‌هایت را بساز.</p>
        <div className="hero-meta"><span><ShieldCheck size={16}/> ثبت‌نام امن</span><span><Layers3 size={16}/> ۱۳ محور رقابتی</span></div>
      </section>
      <section className="form-card">
        <div className="section-heading"><div><span className="eyebrow">فرم شرکت در جشنواره</span><h2>اطلاعات دانش‌آموز</h2></div><div className="step-number">۰۱</div></div>
        <form onSubmit={submitRegistration} className="registration-form" noValidate>
          <label>نام و نام خانوادگی<input value={studentName} onChange={e=>setStudentName(e.target.value)} placeholder="مثلاً علی رضایی" maxLength={100} required/></label>
          <label>شماره موبایل والدین<input inputMode="numeric" value={phone} onChange={e=>setPhone(e.target.value.replace(/[^0-9]/g,''))} placeholder="09123456789" maxLength={11} required/></label>
          <div className="field-grid">
            <label>پایه تحصیلی<select value={grade} onChange={e=>setGrade(e.target.value)}><option>هفتم</option><option>هشتم</option><option>نهم</option></select></label>
            <label>شماره کلاس<input value={classNumber} onChange={e=>setClassNumber(e.target.value)} placeholder="مثلاً ۲" maxLength={20} required/></label>
          </div>
          <label>محور موردنظر<select value={categoryId} onChange={e=>setCategoryId(e.target.value)} required><option value="">یک رشته انتخاب کنید</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}{c.capacity!==null?` · ظرفیت ${c.capacity}`:''}</option>)}</select></label>
          {selectedCategory && <div className="selection-note"><CheckCircle2 size={16}/> انتخاب شما: {selectedCategory.name}</div>}
          {!globalOpen ? <div className="empty-inline">ثبت‌نام جشنواره در حال حاضر توسط صاحب سایت متوقف شده است.</div> : categories.length===0 && <div className="empty-inline">در حال حاضر ثبت‌نام رشته‌ای فعال نیست.</div>}
          <button className="primary-btn submit-btn" disabled={loading||!configured||!globalOpen||categories.length===0}>{loading?'در حال ثبت…':'ثبت‌نام نهایی'} <span>←</span></button>
          <p className="privacy-note"><LockKeyhole size={13}/> اطلاعات فقط برای امور اجرایی جشنواره استفاده می‌شود.</p>
        </form>
      </section>
      <section className="info-strip"><div><strong>۱۳</strong><span>محور جشنواره</span></div><div><strong>۷ تا ۹</strong><span>پایه تحصیلی</span></div><div><strong>یک قدم</strong><span>تا شروع تجربه جدید</span></div></section>
    </main> : <main className="admin-main">
      {!session ? <section className="login-wrap"><div className="login-card">
        <div className="login-icon"><ShieldCheck size={28}/></div><span className="eyebrow">دسترسی مدیران</span><h1>ورود به پنل مدیریت</h1><p>برای مشاهده و مدیریت ثبت‌نام‌ها وارد حساب مدیر شوید.</p>
        <form onSubmit={login}><label>ایمیل مدیر<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com" required/></label><label>رمز عبور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="رمز عبور" required/></label><button className="primary-btn" disabled={loading||!configured}>{loading?'در حال ورود…':'ورود امن'} <span>←</span></button></form>
        <div className="login-foot"><LockKeyhole size={14}/> حساب مدیر باید قبلاً در Supabase ساخته و مجاز شده باشد.</div>
      </div></section> : <div className="dashboard">
        <aside className="sidebar"><div className="side-title"><div className="brand-mark"><GraduationCap/></div><div><b>مرکز مدیریت</b><small>خوارزمی · ۱۴۰۵</small></div></div>
          <div className="side-label">مدیریت سامانه</div><button className="side-item selected"><ChartNoAxesColumn size={17}/> نمای کلی</button><button className="side-item" onClick={()=>document.getElementById('categories')?.scrollIntoView({behavior:'smooth'})}><Layers3 size={17}/> مدیریت رشته‌ها</button><button className="side-item" onClick={()=>document.getElementById('registrations')?.scrollIntoView({behavior:'smooth'})}><Users size={17}/> دانش‌آموزان</button>
          <div className="side-label">ابزارها</div><button className="side-item" onClick={exportExcel}><Download size={17}/> خروجی اکسل</button><button className="side-item" onClick={()=>window.print()}><Printer size={17}/> چاپ فهرست</button><button className="side-item" onClick={backup}><Database size={17}/> پشتیبان اطلاعات</button>
          <div className="sidebar-bottom"><span className="admin-avatar">{(session.user.email||'A')[0].toUpperCase()}</span><div className="admin-id"><b>مدیر سامانه</b><small>{session.user.email}</small></div></div>
        </aside>
        <div className="dashboard-content">
          <div className="dash-header"><div><span className="eyebrow">داشبورد مدیریتی</span><h1>نمای کلی جشنواره</h1><p>آمار و وضعیت ثبت‌نام دانش‌آموزان را مدیریت کنید.</p></div><div className="header-actions"><button className="outline-btn" onClick={()=>loadAdminData()}><RefreshCw size={16}/> بروزرسانی</button><button className="outline-btn" onClick={changePassword}><KeyRound size={16}/> تغییر رمز</button></div></div>
          <div className="stats-grid">
            <Stat icon={<Users/>} label="کل ثبت‌نام‌ها" value={registrations.length.toLocaleString('fa-IR')}/>
            <Stat icon={<Layers3/>} label="محورهای فعال" value={activeCount.toLocaleString('fa-IR')}/>
            <Stat icon={<CheckCircle2/>} label="ظرفیت‌های تکمیل‌شده" value={categories.filter(c=>c.capacity!==null&&registrations.filter(r=>r.category_id===c.id).length>=c.capacity).length.toLocaleString('fa-IR')}/>
            <Stat icon={<ChartNoAxesColumn/>} label="تعداد رشته‌ها" value={categories.length.toLocaleString('fa-IR')}/>
          </div>
          <section className="panel-section chart-section"><div className="panel-heading"><div><span className="eyebrow">گزارش آماری</span><h2>مقایسه استقبال از رشته‌ها</h2></div><span className="subtle-tag">بر اساس ثبت‌نام‌ها</span></div>
            <div className="chart-wrap">{counts.length? <ResponsiveContainer width="100%" height="100%"><BarChart data={counts} margin={{top:12,right:8,left:0,bottom:55}}><CartesianGrid strokeDasharray="3 3" stroke="#252c38"/><XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} tick={{fill:'#9ca8b8',fontSize:10}} axisLine={{stroke:'#343d4b'}}/><YAxis allowDecimals={false} tick={{fill:'#9ca8b8',fontSize:11}} axisLine={false}/><Tooltip contentStyle={{background:'#151b25',border:'1px solid #303a49',borderRadius:12,color:'#fff'}}/><Bar dataKey="count" name="ثبت‌نام" fill="#7da8dc" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer>:<div className="empty-inline">هنوز داده‌ای برای نمایش وجود ندارد.</div>}</div>
          </section>
          <section className="panel-section" id="categories"><div className="panel-heading"><div><span className="eyebrow">تنظیمات رقابت</span><h2>مدیریت محورهای جشنواره</h2></div><button className="primary-small" onClick={()=>{setEditing(null);setCatName('');setCatCapacity('');document.getElementById('category-editor')?.scrollIntoView({behavior:'smooth'})}}><Plus size={16}/> افزودن رشته</button></div>
            <div className="category-grid">{categories.map(c=>{const n=registrations.filter(r=>r.category_id===c.id).length;const pct=c.capacity?Math.min(100,n/c.capacity*100):0;return <div className="category-card" key={c.id}><div className="category-top"><b>{c.name}</b><span className={c.is_open?'status open':'status closed'}>{c.is_open?'باز':'بسته'}</span></div><div className="category-count"><strong>{n.toLocaleString('fa-IR')}</strong><span>ثبت‌نام</span><small>{c.capacity===null?'ظرفیت نامحدود':`از ${c.capacity.toLocaleString('fa-IR')} نفر`}</small></div><div className="progress"><i style={{width:`${pct}%`}}/></div><div className="category-actions"><button onClick={()=>toggleCategory(c)}>{c.is_open?'توقف ثبت‌نام':'بازکردن ثبت‌نام'}</button><button aria-label="ویرایش" onClick={()=>{setEditing(c);setCatName(c.name);setCatCapacity(c.capacity?.toString()||'');document.getElementById('category-editor')?.scrollIntoView({behavior:'smooth'})}}><Pencil size={15}/></button><button aria-label="حذف" onClick={()=>deleteCategory(c)}><Trash2 size={15}/></button></div></div>})}</div>
            <form className="editor-form" id="category-editor" onSubmit={saveCategory}><div><span className="eyebrow">{editing?'ویرایش محور':'افزودن محور جدید'}</span><h3>{editing?'مشخصات رشته':'رشته جدید'}</h3></div><label>نام رشته<input value={catName} onChange={e=>setCatName(e.target.value)} required placeholder="عنوان محور"/></label><label>ظرفیت (خالی = نامحدود)<input type="number" min="1" value={catCapacity} onChange={e=>setCatCapacity(e.target.value)} placeholder="مثلاً ۳۰"/></label><button className="primary-small">{editing?'ذخیره تغییرات':'افزودن رشته'}</button>{editing&&<button type="button" className="outline-btn" onClick={()=>setEditing(null)}>انصراف</button>}</form>
          </section>
          <section className="panel-section" id="registrations"><div className="panel-heading"><div><span className="eyebrow">فهرست شرکت‌کنندگان</span><h2>دانش‌آموزان ثبت‌نام‌شده</h2></div><div className="table-actions"><button className="outline-btn" onClick={exportExcel}><Download size={15}/> Excel</button><button className="outline-btn" onClick={()=>window.print()}><Printer size={15}/> چاپ</button></div></div>
            <div className="filters"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجوی نام، موبایل یا کلاس…"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">همه رشته‌ها</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="table-scroll"><table><thead><tr><th>دانش‌آموز</th><th>پایه / کلاس</th><th>شماره والد</th><th>رشته</th><th>زمان ثبت‌نام</th><th>عملیات</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><b>{r.student_name}</b></td><td>{r.grade} / {r.class_number}</td><td><a className="phone-link" href={`tel:${r.parent_phone}`}><Phone size={14}/>{r.parent_phone}</a></td><td>{r.categories?.name||'—'}</td><td>{new Date(r.created_at).toLocaleString('fa-IR')}</td><td><div className="row-actions"><button title="تغییر رشته" onClick={()=>{setEditReg(r);setNewRegCategory(r.category_id)}}><ArrowRightLeft size={15}/></button><button title="حذف" onClick={()=>deleteRegistration(r)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table>{filtered.length===0&&<div className="empty-inline">دانش‌آموزی مطابق جست‌وجو پیدا نشد.</div>}</div>
            <div className="table-footer">نمایش {filtered.length.toLocaleString('fa-IR')} نفر از {registrations.length.toLocaleString('fa-IR')} ثبت‌نام</div>
          </section>
          <div className="security-note"><ShieldCheck size={18}/><span>دسترسی این بخش فقط برای حساب‌های مدیر تأییدشده در پایگاه داده مجاز است.</span></div>
        </div>
      </div>}
    </main>}
    {ownerLoginOpen && <div className="modal-backdrop owner-login-backdrop"><form className="modal owner-login-modal" onSubmit={ownerLogin}><button type="button" className="modal-close" onClick={()=>setOwnerLoginOpen(false)}><X/></button><span className="owner-kicker">AUTHENTICATION REQUIRED</span><h2>ورود صاحب سایت</h2><p className="owner-hint">دسترسی محافظت‌شده · فقط مالک سامانه</p><label>ایمیل مالک<input type="email" value={ownerEmail} readOnly /></label><label>رمز عبور<input type="password" value={ownerPassword} onChange={e=>setOwnerPassword(e.target.value)} placeholder="رمز عبور صاحب سایت" required autoComplete="current-password"/></label><button className="owner-toggle safe" disabled={loading}>{loading?'در حال بررسی…':'ورود به پنل مالک'}</button></form></div>}
    {successScreen && <div className="success-overlay" role="dialog" aria-modal="true" aria-labelledby="success-title" dir="rtl">
      <div className="confetti-rain" aria-hidden="true">{Array.from({length:56},(_,i)=><i key={i} style={{left:(i*37)%100+"%",animationDelay:((i%14)*0.13)+"s",animationDuration:(3.2+(i%5)*0.35)+"s",transform:"rotate("+((i*29)%180)+"deg)"}} />)}</div>
      <div className="success-card">
        <div className="success-check"><CheckCircle2 size={54}/></div>
        <span className="success-kicker">جشنواره نوجوان خوارزمی</span>
        <h2 id="success-title">ثبت‌نام با موفقیت انجام شد!</h2>
        <p>اطلاعات شما با موفقیت ثبت شد. برای تجربه‌های تازه و درخشش استعدادت آماده باش!</p>
        <button className="primary-btn" onClick={()=>setSuccessScreen(false)}>متوجه شدم</button>
      </div>
    </div>}
    <footer className="footer"><span>KHARAZMI · STUDENT FESTIVAL</span><span>سامانه مدیریت جشنواره نوجوان خوارزمی</span></footer>

    {editReg&&<div className="modal-backdrop"><form className="modal" onSubmit={moveRegistration}><button type="button" className="modal-close" onClick={()=>setEditReg(null)}><X/></button><span className="eyebrow">مدیریت شرکت‌کننده</span><h2>تغییر رشته دانش‌آموز</h2><p>{editReg.student_name}</p><label>رشته جدید<select value={newRegCategory} onChange={e=>setNewRegCategory(e.target.value)} required>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="primary-btn">ثبت تغییرات</button></form></div>}
  </div>
}

function Stat({icon,label,value}:{icon:ReactNode,label:string,value:string}) {
 return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div>
}
export default App
