# ບຸນມາ AI v3.5 — ວິທີຕິດຕັ້ງ

## 1) ຖານຂໍ້ມູນ (Supabase → SQL Editor)
ຣັນໄຟລ໌ `supabase_setup.sql` ທັງໝົດ (ຣັນຊ້ຳໄດ້ ບໍ່ລຶບຂໍ້ມູນ) — ສ່ວນໃໝ່ຢູ່ທ້າຍໄຟລ໌ "v3.4".
ຕື່ມ: ປະເພດຂໍ້ຄວາມ file/link, list_group_members, remove_group_member, ປ້ອງກັນບໍ່ໃຫ້ເຈົ້າຂອງຫ້ອງແກ້ຄ່າອື່ນນອກຈາກ ຊື່/ຄຳອະທິບາຍ.

## 2) ອັບໂຫຼດເວັບ (GitHub Pages)
ອັບໂຫຼດທຸກໄຟລ໌ **ລວມໂຟນເດີ `js/` ແລະ `assets/`** ແລ້ວ Ctrl+Shift+R ໃນເບົາເຊີ.
ຜູ້ໃຊ້ເກົ່າຈະເຫັນແຖບ "ມີເວີຊັນໃໝ່ — ອັບເດດ". ທຸກຄັ້ງທີ່ປ່ອຍເວີຊັນໃໝ່ ໃຫ້ແກ້ `VERSION` ໃນ `sw.js`.

## 3) ລຶບຜູ້ໃຊ້ຖາວອນ (Edge Function)
ລຶບບັນຊີເຂົ້າລະບົບຕ້ອງໃຊ້ service-role key ຈຶ່ງເຮັດໃນເວັບບໍ່ໄດ້. ເລືອກວິທີໃດວິທີໜຶ່ງ:
- Dashboard: Edge Functions → Create function ຊື່ `delete-user` → ວາງໂຄ້ດຈາກ `supabase/functions/delete-user/index.ts` → Deploy (ເປີດ "Verify JWT" ໄວ້)
- CLI: `supabase functions deploy delete-user --project-ref pqowiefyxyhpzwvzydlr`
ກົດລະບຽບ: ສະເພາະ Admin, ລຶບຕົວເອງບໍ່ໄດ້, ລຶບ Admin ຄົນສຸດທ້າຍບໍ່ໄດ້, ຫ້ອງທີ່ຜູ້ຖືກລຶບສ້າງຈະໂອນໃຫ້ Admin ທີ່ກົດລຶບ.

## 4) (ແນະນຳ ເຮັດພາຍຫຼັງ) Tailwind ແບບ local
ຕອນນີ້ຍັງໃຊ້ `cdn.tailwindcss.com` (ເປັນສະບັບທົດລອງ ຊ້າ ແລະຕ້ອງມີເນັດ). ເພື່ອປ່ຽນ:
1. ຕິດຕັ້ງ Node.js ໃນຄອມ
2. ໃນໂຟນເດີໂປຣເຈັກ: `npm run build:css` (ໄດ້ໄຟລ໌ `styles.css`)
3. ໃນ `index.html` ລຶບ 2 ບລັອກ `<script src="https://cdn.tailwindcss.com">` + `tailwind.config = ...` ແລ້ວໃສ່ `<link rel="stylesheet" href="styles.css">`
4. ເພີ່ມ `./styles.css` ໃນ APP_SHELL ຂອງ `sw.js` ແລະແກ້ VERSION

## 5) ກວດດ້ວຍເຄື່ອງຈິງ (ຕ້ອງເຮັດ — ຂ້ອຍທົດສອບໃນເຄື່ອງຈິງບໍ່ໄດ້)
- Android Chrome: ປຸ່ມ "📲 ຕິດຕັ້ງແອັບ" ຂຶ້ນໜ້າຕ່າງຕິດຕັ້ງ; ກົດ "ເປີດແອັບ" ຂອງ ChatGPT/Claude/Gemini ແລ້ວເປີດແອັບ (ຖ້າມີ) ຫຼືເວັບ (ຖ້າບໍ່ມີ)
- iPhone Safari: ປຸ່ມຕິດຕັ້ງສະແດງຂັ້ນຕອນ Share → Add to Home Screen; ກວດວ່າ AI ໃດເປີດແອັບໄດ້
- ຖ້າແອັບໃດເປີດບໍ່ຖືກ: ແກ້ຕາຕະລາງ `APPS` ເທິງສຸດຂອງ `js/ai-apps.js` (pkg = ຊື່ແພັກເກດ Android, ios = URL scheme)
- ລອງລິ້ງຫ້ອງ: ຄູກົດ "ແບ່ງປັນລິ້ງ" → ເປີດໃນນັກຮຽນທີ່ຍັງບໍ່ລັອກອິນ → ສະໝັກ/ເຂົ້າສູ່ລະບົບ → ຄວນເຂົ້າຫ້ອງເອງ

## ຂໍ້ຈຳກັດທີ່ຄວນຮູ້
- ໄຟລ໌ແນບເກັບໃນ IndexedDB ຂອງເຄື່ອງຜູ້ສົ່ງ: ຖ້າລ້າງຂໍ້ມູນເບົາເຊີ/ເປີດໂໝດສ່ວນຕົວ ໄຟລ໌ຈະຫາຍ; ຄົນອື່ນໃນຫ້ອງເຫັນແຕ່ຊື່ໄຟລ໌ (ໃຫ້ແປະລິ້ງ Drive ຖ້າຢາກໃຫ້ເປີດໄດ້). ຂໍ້ຄວາມແນບເກົ່າ (ກ່ອນ v3.4) ຍັງເປີດໄດ້ຈາກ Supabase.
- ຮູບໂປຣໄຟລ໌ (avatar) ຍັງເກັບໃນ Supabase (ຮູບນ້ອຍ ≤ 2 MB).
- ອີເມວຂອງສະມາຊິກສະແດງສະເພາະຄູ/Admin, ແຕ່ນະໂຍບາຍ `profiles_select_classmates` ເດີມຍັງໃຫ້ເພື່ອນຮ່ວມຫ້ອງອ່ານແຖວໂປຣໄຟລ໌ (ລວມອີເມວ) ຜ່ານ API ໂດຍກົງ — ແກ້ໃນຮອບ Security.


---
# ເພີ່ມໃນ v3.5 — ໄຟລ໌ແຊັດທີ່ໝັ້ນຄົງ ສຳລັບ Supabase ແຜນຟຣີ

## ວິທີທຳງານ
- **ແຊຣ໌ໃຫ້ສະມາຊິກ** (ຄ່າເລີ່ມຕົ້ນ): ໄຟລ໌ຂຶ້ນ Supabase ຊົ່ວຄາວ → ທຸກຄົນໃນຫ້ອງ ເບິ່ງຕົວຢ່າງ ແລະດາວໂຫຼດໄດ້ → ຖືກລຶບອັດຕະໂນມັດຫຼັງ 14 ວັນ
- **ເກັບໃນເຄື່ອງຂ້ອຍເທົ່ານັ້ນ**: ບໍ່ຂຶ້ນເຊີບເວີ (ແບບ v3.4)
- **ລິ້ງ Drive**: ສຳລັບໄຟລ໌ໃຫຍ່ກວ່າ 5 MB
- ຜູ້ຮັບດາວໂຫຼດຄັ້ງທຳອິດຈາກເຊີບເວີ ຄັ້ງຕໍ່ໄປເປີດຈາກແຄຊໃນເຄື່ອງ (ປະຢັດ bandwidth 5 GB/ເດືອນ); ຮູບຖືກບີບອັດ ແລະມີຮູບຍ່ອ (thumbnail) ໃນແຊັດ

## ເພດານ (ແກ້ໄດ້ບ່ອນດຽວ: ຟັງຊັນ `bounma_limits()` ໃນ SQL ແລ້ວຣັນຄືນ)
ຫ້ອງລະ 100 MB • ໄຟລ໌ລະ 5 MB (ຮູບ 3 MB) • 14 ວັນ • 30 ໄຟລ໌/ຄົນ/24 ຊມ. • 20 ຂໍ້ຄວາມ/ຄົນ/ນາທີ • ຂໍ້ຄວາມ ≤ 4000 ຕົວອັກສອນ
ປະເພດທີ່ອະນຸຍາດ: ຮູບ, PDF, Word, Excel, PowerPoint, TXT, CSV, MP3, MP4 (ບໍ່ຮັບ ZIP/EXE/HTML)
ເພດານບັງຄັບທີ່ຖານຂໍ້ມູນ ຈຶ່ງຂ້າມຜ່ານຈາກເວັບບໍ່ໄດ້

## ຂັ້ນຕອນຕິດຕັ້ງ v3.5
1. ຣັນ `supabase_setup.sql` ທັງໝົດຄືນ (ສ່ວນ v3.5 ຢູ່ທ້າຍໄຟລ໌) ແລ້ວຣັນ `supabase_checks.sql` ເພື່ອກວດ
2. ອັບໂຫຼດເວັບໃໝ່ (ມີໄຟລ໌ໃໝ່ `js/filepreview.js`)
3. Deploy Edge Function ລຶບໄຟລ໌ໝົດອາຍຸ:
   `supabase functions deploy cleanup-files --no-verify-jwt`
   `supabase secrets set CLEANUP_SECRET=<ຂໍ້ຄວາມສຸ່ມຍາວໆ>`
   - ປຸ່ມ "🧹 ລ້າງໄຟລ໌ໝົດອາຍຸ" ໃນແຖບ ຜູ້ໃຊ້ (Admin) ເອີ້ນໄດ້ທັນທີ
   - ຢາກໃຫ້ລຶບເອງທຸກຄືນ: ເປີດ extension pg_cron ແລະ pg_net ແລ້ວຣັນຄຳສັ່ງ `cron.schedule` ທີ່ຄອມເມັນໄວ້ທ້າຍ SQL
4. ກັນ Supabase ແຜນຟຣີ pause: ເອົາໂຟນເດີ `.github/workflows/keepalive.yml` ຂຶ້ນ repo (ຢູ່ root) ແລ້ວເພີ່ມ Secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` (GitHub → Settings → Secrets → Actions)

## ຂໍ້ຈຳກັດ
- ຕົວຢ່າງ PDF ໃຊ້ pdf.js ຈາກ cdnjs ຕ້ອງມີເນັດ (ບໍ່ມີເນັດ: Desktop ໃຊ້ iframe, ມືຖືມີປຸ່ມເປີດແທັບໃໝ່). Word/Excel/PowerPoint ບໍ່ມີຕົວຢ່າງ ມີແຕ່ປຸ່ມດາວໂຫຼດ
- SQL ຂອງ v3.4/v3.5 ຍັງບໍ່ໄດ້ຣັນກັບ Postgres ຈິງ (ບໍ່ມີ Postgres ໃນສະພາບແວດລ້ອມທົດສອບ) — ຖ້າມີ error ໃນ SQL Editor ສົ່ງຂໍ້ຄວາມ error ມາໃຫ້ຂ້ອຍ
- ແຜນຟຣີ Realtime ຮອງຮັບ ~200 ການເຊື່ອມຕໍ່ພ້ອມກັນ (ຫ້ອງໃຫຍ່ຫຼາຍຫ້ອງພ້ອມກັນອາດເຕັມ)
