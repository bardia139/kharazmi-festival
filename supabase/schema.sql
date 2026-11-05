-- جشنواره نوجوان خوارزمی | Supabase schema
-- Run the entire file in Supabase SQL Editor on a new project.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 120),
  description text,
  capacity integer check (capacity is null or capacity > 0),
  is_open boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  student_name text not null check (char_length(trim(student_name)) between 3 and 100),
  parent_phone text not null check (parent_phone ~ '^09[0-9]{9}$'),
  grade text not null check (grade in ('هفتم','هشتم','نهم')),
  class_number text not null check (char_length(trim(class_number)) between 1 and 20),
  category_id uuid not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  student_key text generated always as (lower(regexp_replace(trim(student_name), '\s+', ' ', 'g')) || ':' || parent_phone) stored
);

create unique index if not exists registrations_one_per_student_category
on public.registrations(student_key, category_id);

create index if not exists registrations_category_id_idx on public.registrations(category_id);
create index if not exists registrations_created_at_idx on public.registrations(created_at desc);

alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.registrations enable row level security;

-- SQL privileges are required in addition to RLS policies.
grant usage on schema public to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select, update, delete on public.registrations to authenticated;
grant select on public.admins to authenticated;

drop policy if exists "admins can read own admin row" on public.admins;
create policy "admins can read own admin row" on public.admins
for select to authenticated using (user_id = auth.uid());

drop policy if exists "public can view open categories" on public.categories;
create policy "public can view open categories" on public.categories
for select to anon, authenticated using (is_open = true or public.is_admin());

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read registrations" on public.registrations;
create policy "admins read registrations" on public.registrations
for select to authenticated using (public.is_admin());

drop policy if exists "admins update registrations" on public.registrations;
create policy "admins update registrations" on public.registrations
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete registrations" on public.registrations;
create policy "admins delete registrations" on public.registrations
for delete to authenticated using (public.is_admin());

-- Registration is performed only through this function. Anonymous clients cannot insert directly.
create or replace function public.register_student(
  p_student_name text,
  p_parent_phone text,
  p_grade text,
  p_class_number text,
  p_category_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category public.categories%rowtype;
  v_count integer;
  v_name text := trim(regexp_replace(coalesce(p_student_name,''), '\s+', ' ', 'g'));
  v_phone text := trim(coalesce(p_parent_phone,''));
  v_class text := trim(coalesce(p_class_number,''));
begin
  if char_length(v_name) < 3 or char_length(v_name) > 100 then
    raise exception 'نام و نام خانوادگی معتبر نیست.';
  end if;
  if v_phone !~ '^09[0-9]{9}$' then
    raise exception 'شماره موبایل والد باید ۱۱ رقم و با 09 شروع شود.';
  end if;
  if p_grade not in ('هفتم','هشتم','نهم') then
    raise exception 'پایه تحصیلی معتبر نیست.';
  end if;
  if char_length(v_class) < 1 or char_length(v_class) > 20 then
    raise exception 'شماره کلاس معتبر نیست.';
  end if;

  select * into v_category from public.categories where id = p_category_id for update;
  if not found then raise exception 'رشته انتخاب‌شده پیدا نشد.'; end if;
  if not v_category.is_open then raise exception 'ثبت‌نام این رشته بسته شده است.'; end if;

  select count(*) into v_count from public.registrations where category_id = p_category_id;
  if v_category.capacity is not null and v_count >= v_category.capacity then
    raise exception 'ظرفیت این رشته تکمیل شده است.';
  end if;

  if exists (
    select 1 from public.registrations
    where student_key = lower(v_name) || ':' || v_phone and category_id = p_category_id
  ) then
    raise exception 'این دانش‌آموز قبلاً در همین رشته ثبت‌نام کرده است.';
  end if;

  insert into public.registrations(student_name,parent_phone,grade,class_number,category_id)
  values(v_name,v_phone,p_grade,v_class,p_category_id);

  return jsonb_build_object('success',true,'message','ثبت‌نام با موفقیت انجام شد.');
end;
$$;

revoke all on function public.register_student(text,text,text,text,uuid) from public;
grant execute on function public.register_student(text,text,text,text,uuid) to anon, authenticated;

-- Seed all 13 official festival axes. Safe to run more than once.
insert into public.categories(name, sort_order) values
('قرآن و معارف اسلامی',1),
('پژوهش',2),
('زبان و ادبیات فارسی',3),
('فرهنگ و هنر',4),
('سلامت و تربیت بدنی',5),
('دست‌سازه',6),
('بازارچه کسب‌وکار دانش‌آموزی',7),
('برنامه‌نویسی',8),
('مناظره مطالعات اجتماعی',9),
('ریاضی',10),
('فعالیت‌های آزمایشگاهی',11),
('زبان انگلیسی',12),
('بازی‌های مهارتی و توسعه فردی',13)
on conflict (name) do nothing;

-- IMPORTANT: After creating the manager account in Authentication > Users,
-- run this statement to grant admin access to the exact email:
-- insert into public.admins(user_id)
-- select id from auth.users where lower(email) = lower('topchi1405@qrypty.com')
-- on conflict do nothing;
