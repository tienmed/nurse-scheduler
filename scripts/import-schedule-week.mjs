import { google } from "googleapis";
import { randomUUID } from "node:crypto";

const sheetId = process.env.GOOGLE_SHEET_ID;
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!sheetId || !email || !key) {
  console.error("Thiếu biến môi trường Google Sheets.");
  process.exit(1);
}

const auth = new google.auth.JWT({
  email,
  key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const weekStart = "2026-11-16";

// Nhân sự
const STAFF = {
  NHIEN: "staff-dd6-gmail-com",
  CHUYEN: "staff-dd8-gmail-com",
  LIEN: "staff-1774712183681",
  DIEP: "staff-dd7-gmail-com",
  THUY: "staff-1774712128869",
  NHAN: "staff-1774718907633",
  THAO: "staff-1774711054183",
  HANH: "staff-dd2-gmail-com",
  THINH: "staff-1774712084428",
  NGA: "staff-dd4-gmail-com",
  VINH: "staff-dd5-gmail-com",
  HOA: "staff-dd3-gmail-com",
  PHUC_ANH: "staff-1774922284323",
  LYNA: "staff-1774924267325",
};

// Vị trí
const POS = {
  DA_LIEU: "position-phong-kham-da-lieu",
  CSD: "position-phong-cham-soc-da",
  MAT: "position-phong-kham-mat",
  TMH: "position-phong-kham-tmh",
  TL_TT: "position-phong-kham-ttk",
  NOI_TIM_MACH: "position-noi-tim-mach",
  YHCT: "position-yhct",
  THANH_TRUNG: "position-thanh-trung",
  SIEU_AM: "position-phong-sieu-am",
  CAP_CUU: "position-phong-cap-cuu",
  CXK: "position-phong-kham-ctch",
  NOI_1: "position-phong-kham-noi-1",
  NGOAI: "position-phong-kham-ngoai",
  SAN: "position-phong-kham-phu-san",
  NOI_2: "position-phong-kham-noi-2",
  ECG: "position-phong-o-ecg",
  BSGD: "position-phong-kham-bsgd",
  NOI_TK: "position-noi-than-kinh",
  DO_SINH_HIEU: "position-o-sinh-hieu",
  CHUYEN_GIA: "position-phong-kham-chuyen-gia",
  DU_MD: "pos-1775185718350-um0fc",
  TIEP_NHAN: "position-tiep-nhan",
  HO_SO_KSK: "position-nhap-lieu-ksk",
};

// Định nghĩa dữ liệu lịch phân công từ ảnh
const assignmentsDef = [
  // ==================== THỨ 2 (2026-11-16) ====================
  // Sáng
  { date: "2026-11-16", shift: "morning", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-16", shift: "morning", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-16", shift: "morning", pos: POS.MAT, staff: STAFF.CHUYEN },
  { date: "2026-11-16", shift: "morning", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-16", shift: "morning", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-16", shift: "morning", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-16", shift: "morning", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-16", shift: "morning", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-16", shift: "morning", pos: POS.CAP_CUU, staff: STAFF.HANH },
  { date: "2026-11-16", shift: "morning", pos: POS.CXK, staff: STAFF.NGA },
  { date: "2026-11-16", shift: "morning", pos: POS.NOI_1, staff: STAFF.NGA },
  { date: "2026-11-16", shift: "morning", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-16", shift: "morning", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-16", shift: "morning", pos: POS.NOI_2, staff: STAFF.VINH },
  { date: "2026-11-16", shift: "morning", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-16", shift: "morning", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-16", shift: "morning", pos: POS.NOI_TK, staff: STAFF.HOA },
  { date: "2026-11-16", shift: "morning", pos: POS.DO_SINH_HIEU, staff: STAFF.LIEN },
  { date: "2026-11-16", shift: "morning", pos: POS.DU_MD, staff: STAFF.HOA },
  { date: "2026-11-16", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.PHUC_ANH, slotIndex: 0 },
  { date: "2026-11-16", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.THUY, slotIndex: 1 },

  // Chiều
  { date: "2026-11-16", shift: "afternoon", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-16", shift: "afternoon", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-16", shift: "afternoon", pos: POS.MAT, staff: STAFF.LIEN },
  { date: "2026-11-16", shift: "afternoon", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-16", shift: "afternoon", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-16", shift: "afternoon", pos: POS.NOI_TIM_MACH, staff: STAFF.LIEN },
  { date: "2026-11-16", shift: "afternoon", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-16", shift: "afternoon", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-16", shift: "afternoon", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-16", shift: "afternoon", pos: POS.CAP_CUU, staff: STAFF.HANH },
  { date: "2026-11-16", shift: "afternoon", pos: POS.CXK, staff: STAFF.NGA },
  { date: "2026-11-16", shift: "afternoon", pos: POS.NOI_1, staff: STAFF.NGA },
  { date: "2026-11-16", shift: "afternoon", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-16", shift: "afternoon", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-16", shift: "afternoon", pos: POS.NOI_2, staff: STAFF.VINH },
  { date: "2026-11-16", shift: "afternoon", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-16", shift: "afternoon", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-16", shift: "afternoon", pos: POS.DO_SINH_HIEU, staff: STAFF.THUY },
  { date: "2026-11-16", shift: "afternoon", pos: POS.TIEP_NHAN, staff: STAFF.PHUC_ANH, slotIndex: 0 },
  { date: "2026-11-16", shift: "afternoon", pos: POS.TIEP_NHAN, staff: STAFF.CHUYEN, slotIndex: 1 },
  { date: "2026-11-16", shift: "afternoon", pos: POS.HO_SO_KSK, staff: STAFF.HOA },

  // ==================== THỨ 3 (2026-11-17) ====================
  // Sáng
  { date: "2026-11-17", shift: "morning", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-17", shift: "morning", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-17", shift: "morning", pos: POS.MAT, staff: STAFF.CHUYEN },
  { date: "2026-11-17", shift: "morning", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-17", shift: "morning", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-17", shift: "morning", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-17", shift: "morning", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-17", shift: "morning", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-17", shift: "morning", pos: POS.CAP_CUU, staff: STAFF.HANH },
  { date: "2026-11-17", shift: "morning", pos: POS.NOI_1, staff: STAFF.NGA },
  { date: "2026-11-17", shift: "morning", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-17", shift: "morning", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-17", shift: "morning", pos: POS.NOI_2, staff: STAFF.HOA },
  { date: "2026-11-17", shift: "morning", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-17", shift: "morning", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-17", shift: "morning", pos: POS.NOI_TK, staff: STAFF.LIEN },
  { date: "2026-11-17", shift: "morning", pos: POS.DO_SINH_HIEU, staff: STAFF.LIEN },
  { date: "2026-11-17", shift: "morning", pos: POS.CHUYEN_GIA, staff: STAFF.HOA },
  { date: "2026-11-17", shift: "morning", pos: POS.DU_MD, staff: STAFF.HOA },
  { date: "2026-11-17", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.PHUC_ANH, slotIndex: 0 },
  { date: "2026-11-17", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.THUY, slotIndex: 1 },

  // Chiều
  { date: "2026-11-17", shift: "afternoon", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-17", shift: "afternoon", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-17", shift: "afternoon", pos: POS.MAT, staff: STAFF.THUY },
  { date: "2026-11-17", shift: "afternoon", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-17", shift: "afternoon", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-17", shift: "afternoon", pos: POS.NOI_TIM_MACH, staff: STAFF.THUY },
  { date: "2026-11-17", shift: "afternoon", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-17", shift: "afternoon", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-17", shift: "afternoon", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-17", shift: "afternoon", pos: POS.CAP_CUU, staff: STAFF.HANH },
  { date: "2026-11-17", shift: "afternoon", pos: POS.CXK, staff: STAFF.NGA },
  { date: "2026-11-17", shift: "afternoon", pos: POS.NOI_1, staff: STAFF.NGA },
  { date: "2026-11-17", shift: "afternoon", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-17", shift: "afternoon", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-17", shift: "afternoon", pos: POS.NOI_2, staff: STAFF.HOA },
  { date: "2026-11-17", shift: "afternoon", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-17", shift: "afternoon", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-17", shift: "afternoon", pos: POS.CHUYEN_GIA, staff: STAFF.HOA },
  { date: "2026-11-17", shift: "afternoon", pos: POS.TIEP_NHAN, staff: STAFF.PHUC_ANH, slotIndex: 0 },
  { date: "2026-11-17", shift: "afternoon", pos: POS.TIEP_NHAN, staff: STAFF.CHUYEN, slotIndex: 1 },
  { date: "2026-11-17", shift: "afternoon", pos: POS.HO_SO_KSK, staff: STAFF.HOA },

  // ==================== THỨ 4 (2026-11-18) ====================
  // Sáng
  { date: "2026-11-18", shift: "morning", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-18", shift: "morning", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-18", shift: "morning", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-18", shift: "morning", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-18", shift: "morning", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-18", shift: "morning", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-18", shift: "morning", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-18", shift: "morning", pos: POS.CAP_CUU, staff: STAFF.THINH },
  { date: "2026-11-18", shift: "morning", pos: POS.CXK, staff: STAFF.NGA },
  { date: "2026-11-18", shift: "morning", pos: POS.NOI_1, staff: STAFF.NGA },
  { date: "2026-11-18", shift: "morning", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-18", shift: "morning", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-18", shift: "morning", pos: POS.NOI_2, staff: STAFF.THINH },
  { date: "2026-11-18", shift: "morning", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-18", shift: "morning", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-18", shift: "morning", pos: POS.DO_SINH_HIEU, staff: STAFF.CHUYEN },
  { date: "2026-11-18", shift: "morning", pos: POS.CHUYEN_GIA, staff: STAFF.HOA },
  { date: "2026-11-18", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.PHUC_ANH, slotIndex: 0 },
  { date: "2026-11-18", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.THUY, slotIndex: 1 },

  // Chiều
  { date: "2026-11-18", shift: "afternoon", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-18", shift: "afternoon", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-18", shift: "afternoon", pos: POS.MAT, staff: STAFF.THUY },
  { date: "2026-11-18", shift: "afternoon", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-18", shift: "afternoon", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-18", shift: "afternoon", pos: POS.NOI_TIM_MACH, staff: STAFF.THUY },
  { date: "2026-11-18", shift: "afternoon", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-18", shift: "afternoon", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-18", shift: "afternoon", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-18", shift: "afternoon", pos: POS.CAP_CUU, staff: STAFF.THINH },
  { date: "2026-11-18", shift: "afternoon", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-18", shift: "afternoon", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-18", shift: "afternoon", pos: POS.NOI_2, staff: STAFF.NGA },
  { date: "2026-11-18", shift: "afternoon", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-18", shift: "afternoon", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-18", shift: "afternoon", pos: POS.DO_SINH_HIEU, staff: STAFF.LIEN },
  { date: "2026-11-18", shift: "afternoon", pos: POS.CHUYEN_GIA, staff: STAFF.HOA },
  { date: "2026-11-18", shift: "afternoon", pos: POS.TIEP_NHAN, staff: STAFF.PHUC_ANH, slotIndex: 0 },
  { date: "2026-11-18", shift: "afternoon", pos: POS.TIEP_NHAN, staff: STAFF.CHUYEN, slotIndex: 1 },
  { date: "2026-11-18", shift: "afternoon", pos: POS.HO_SO_KSK, staff: STAFF.THINH },

  // ==================== THỨ 5 (2026-11-19) ====================
  // Sáng
  { date: "2026-11-19", shift: "morning", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-19", shift: "morning", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-19", shift: "morning", pos: POS.MAT, staff: STAFF.LIEN },
  { date: "2026-11-19", shift: "morning", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-19", shift: "morning", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-19", shift: "morning", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-19", shift: "morning", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-19", shift: "morning", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-19", shift: "morning", pos: POS.CAP_CUU, staff: STAFF.THINH },
  { date: "2026-11-19", shift: "morning", pos: POS.NOI_1, staff: STAFF.HOA },
  { date: "2026-11-19", shift: "morning", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-19", shift: "morning", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-19", shift: "morning", pos: POS.NOI_2, staff: STAFF.THINH },
  { date: "2026-11-19", shift: "morning", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-19", shift: "morning", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-19", shift: "morning", pos: POS.DO_SINH_HIEU, staff: STAFF.CHUYEN },
  { date: "2026-11-19", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.PHUC_ANH, slotIndex: 0 },
  { date: "2026-11-19", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.THUY, slotIndex: 1 },

  // Chiều
  { date: "2026-11-19", shift: "afternoon", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-19", shift: "afternoon", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-19", shift: "afternoon", pos: POS.MAT, staff: STAFF.LIEN },
  { date: "2026-11-19", shift: "afternoon", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-19", shift: "afternoon", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-19", shift: "afternoon", pos: POS.NOI_TIM_MACH, staff: STAFF.LIEN },
  { date: "2026-11-19", shift: "afternoon", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-19", shift: "afternoon", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-19", shift: "afternoon", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-19", shift: "afternoon", pos: POS.CAP_CUU, staff: STAFF.THINH },
  { date: "2026-11-19", shift: "afternoon", pos: POS.CXK, staff: STAFF.NGA },
  { date: "2026-11-19", shift: "afternoon", pos: POS.NOI_1, staff: STAFF.NGA },
  { date: "2026-11-19", shift: "afternoon", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-19", shift: "afternoon", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-19", shift: "afternoon", pos: POS.NOI_2, staff: STAFF.HOA },
  { date: "2026-11-19", shift: "afternoon", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-19", shift: "afternoon", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-19", shift: "afternoon", pos: POS.DO_SINH_HIEU, staff: STAFF.THINH },
  { date: "2026-11-19", shift: "afternoon", pos: POS.TIEP_NHAN, staff: STAFF.PHUC_ANH, slotIndex: 0 },
  { date: "2026-11-19", shift: "afternoon", pos: POS.HO_SO_KSK, staff: STAFF.HOA },

  // ==================== THỨ 6 (2026-11-20) ====================
  // Sáng
  { date: "2026-11-20", shift: "morning", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-20", shift: "morning", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-20", shift: "morning", pos: POS.MAT, staff: STAFF.LIEN },
  { date: "2026-11-20", shift: "morning", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-20", shift: "morning", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-20", shift: "morning", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-20", shift: "morning", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-20", shift: "morning", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-20", shift: "morning", pos: POS.CAP_CUU, staff: STAFF.THINH },
  { date: "2026-11-20", shift: "morning", pos: POS.NOI_1, staff: STAFF.NGA },
  { date: "2026-11-20", shift: "morning", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-20", shift: "morning", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-20", shift: "morning", pos: POS.NOI_2, staff: STAFF.HOA },
  { date: "2026-11-20", shift: "morning", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-20", shift: "morning", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-20", shift: "morning", pos: POS.DO_SINH_HIEU, staff: STAFF.THINH },
  { date: "2026-11-20", shift: "morning", pos: POS.CHUYEN_GIA, staff: STAFF.HOA },
  { date: "2026-11-20", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.CHUYEN, slotIndex: 0 },
  { date: "2026-11-20", shift: "morning", pos: POS.TIEP_NHAN, staff: STAFF.THUY, slotIndex: 1 },

  // Chiều
  { date: "2026-11-20", shift: "afternoon", pos: POS.DA_LIEU, staff: STAFF.NHIEN },
  { date: "2026-11-20", shift: "afternoon", pos: POS.CSD, staff: STAFF.NHIEN },
  { date: "2026-11-20", shift: "afternoon", pos: POS.MAT, staff: STAFF.LIEN },
  { date: "2026-11-20", shift: "afternoon", pos: POS.TMH, staff: STAFF.DIEP },
  { date: "2026-11-20", shift: "afternoon", pos: POS.TL_TT, staff: STAFF.DIEP },
  { date: "2026-11-20", shift: "afternoon", pos: POS.NOI_TIM_MACH, staff: STAFF.DIEP },
  { date: "2026-11-20", shift: "afternoon", pos: POS.YHCT, staff: STAFF.NHAN },
  { date: "2026-11-20", shift: "afternoon", pos: POS.THANH_TRUNG, staff: STAFF.NHAN },
  { date: "2026-11-20", shift: "afternoon", pos: POS.SIEU_AM, staff: STAFF.THAO },
  { date: "2026-11-20", shift: "afternoon", pos: POS.CAP_CUU, staff: STAFF.THINH },
  { date: "2026-11-20", shift: "afternoon", pos: POS.CXK, staff: STAFF.NGA },
  { date: "2026-11-20", shift: "afternoon", pos: POS.NOI_1, staff: STAFF.NGA },
  { date: "2026-11-20", shift: "afternoon", pos: POS.NGOAI, staff: STAFF.VINH },
  { date: "2026-11-20", shift: "afternoon", pos: POS.SAN, staff: STAFF.VINH },
  { date: "2026-11-20", shift: "afternoon", pos: POS.NOI_2, staff: STAFF.THINH },
  { date: "2026-11-20", shift: "afternoon", pos: POS.ECG, staff: STAFF.HANH },
  { date: "2026-11-20", shift: "afternoon", pos: POS.BSGD, staff: STAFF.HANH },
  { date: "2026-11-20", shift: "afternoon", pos: POS.DO_SINH_HIEU, staff: STAFF.HOA },
  { date: "2026-11-20", shift: "afternoon", pos: POS.CHUYEN_GIA, staff: STAFF.HOA },
  { date: "2026-11-20", shift: "afternoon", pos: POS.TIEP_NHAN, staff: STAFF.CHUYEN, slotIndex: 0 },
  { date: "2026-11-20", shift: "afternoon", pos: POS.HO_SO_KSK, staff: STAFF.THINH },
];

async function run() {
  console.log(`Bắt đầu nạp ${assignmentsDef.length} ca trực cho tuần ${weekStart}...`);

  // 1. Kiểm tra và dọn dẹp các dòng cũ của tuần 2026-11-16 (nếu có)
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "weekly_schedule!A:J",
  });

  const existingRows = getRes.data.values || [];
  const keepRows = [];
  const headers = existingRows[0] || [
    "id",
    "weekStart",
    "date",
    "shift",
    "positionId",
    "staffId",
    "slotIndex",
    "source",
    "status",
    "note",
  ];

  keepRows.push(headers);

  let removedCount = 0;
  for (let i = 1; i < existingRows.length; i++) {
    const row = existingRows[i];
    if (row[1] === weekStart) {
      removedCount++;
    } else {
      keepRows.push(row);
    }
  }

  if (removedCount > 0) {
    console.log(`Đã tìm thấy và dọn dẹp ${removedCount} dòng cũ của tuần ${weekStart}.`);
  }

  // 2. Chuyển đổi assignmentsDef thành hàng dữ liệu
  const newRows = assignmentsDef.map((a) => [
    `weekly-${Date.now()}-${randomUUID().slice(0, 5)}`,
    weekStart,
    a.date,
    a.shift,
    a.pos,
    a.staff,
    String(a.slotIndex ?? 0),
    "manual",
    "published",
    "",
  ]);

  const finalRows = [...keepRows, ...newRows];

  // 3. Ghi lại dữ liệu bảng weekly_schedule
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: "weekly_schedule!A:Z",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `weekly_schedule!A1:J${finalRows.length}`,
    valueInputOption: "RAW",
    requestBody: {
      values: finalRows,
    },
  });

  console.log(`✅ Đã nạp thành công ${newRows.length} ca trực vào bảng weekly_schedule!`);

  // 4. Bổ sung đơn nghỉ ốm của Lyna cho T5 (19/11) và T6 (20/11) nếu chưa có
  const lrRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "leave_requests!A:H",
  });
  const lrRows = lrRes.data.values || [];
  const hasLynaT5 = lrRows.some((r) => r[1] === STAFF.LYNA && r[2] === "2026-11-19");
  const hasLynaT6 = lrRows.some((r) => r[1] === STAFF.LYNA && r[2] === "2026-11-20");

  const newLeaves = [];
  if (!hasLynaT5) {
    newLeaves.push([
      `leave-${Date.now()}-${randomUUID().slice(0, 5)}`,
      STAFF.LYNA,
      "2026-11-19",
      "full-day",
      "om",
      "[Theo lịch tuần]",
      "approved",
      randomUUID(),
    ]);
  }
  if (!hasLynaT6) {
    newLeaves.push([
      `leave-${Date.now() + 1}-${randomUUID().slice(0, 5)}`,
      STAFF.LYNA,
      "2026-11-20",
      "full-day",
      "om",
      "[Theo lịch tuần]",
      "approved",
      randomUUID(),
    ]);
  }

  if (newLeaves.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "leave_requests!A:H",
      valueInputOption: "RAW",
      requestBody: {
        values: newLeaves,
      },
    });
    console.log(`✅ Đã đồng bộ thêm ${newLeaves.length} ngày nghỉ ốm của Lyna (19/11 & 20/11) vào leave_requests.`);
  }
}

run().catch((err) => {
  console.error("Lỗi khi nạp lịch:", err);
  process.exit(1);
});
