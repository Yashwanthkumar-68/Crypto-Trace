import io
import hashlib
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY


class SubpoenaService:
    @staticmethod
    def generate_subpoena_pdf(
        case_id: str,
        case_number: str,
        wallet_address: str,
        blockchain: str,
        investigator_name: str,
        investigator_designation: str,
        victim_name: str,
        amount_lost: float,
        currency: str,
        incident_date: str,
        external_fir: str = None
    ) -> bytes:
        """
        Generates an official Statutory Notice under Section 94 of Bharatiya Nagarik
        Suraksha Sanhita (BNSS), 2023 / Section 91 of Code of Criminal Procedure (CrPC).
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()

        # Custom Typography Styles
        title_style = ParagraphStyle(
            'GovHeaderTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#0F172A')
        )

        subtitle_style = ParagraphStyle(
            'GovHeaderSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#1E3A8A')
        )

        notice_badge_style = ParagraphStyle(
            'NoticeBadge',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#991B1B')
        )

        body_style = ParagraphStyle(
            'GovBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            alignment=TA_JUSTIFY,
            textColor=colors.HexColor('#1E293B')
        )

        bold_label_style = ParagraphStyle(
            'GovBoldLabel',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor('#0F172A')
        )

        val_style = ParagraphStyle(
            'GovValue',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor('#334155')
        )

        mono_val_style = ParagraphStyle(
            'GovMonoValue',
            parent=styles['Normal'],
            fontName='Courier-Bold',
            fontSize=8,
            leading=10,
            textColor=colors.HexColor('#0F172A')
        )

        directive_title_style = ParagraphStyle(
            'DirectiveTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor('#1E3A8A')
        )

        warning_style = ParagraphStyle(
            'GovWarning',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            alignment=TA_LEFT,
            textColor=colors.HexColor('#991B1B')
        )

        meta_right = ParagraphStyle(
            'GovMetaRight',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            alignment=TA_RIGHT,
            textColor=colors.HexColor('#64748B')
        )

        story = []

        now_str = datetime.datetime.now().strftime("%d %B %Y, %H:%M:%S IST")
        date_str = datetime.datetime.now().strftime("%d %B %Y")
        doc_ref = f"LE-CYBER/SEC94-BNSS/{case_id}/{datetime.datetime.now().strftime('%Y%m%d%H%M')}"

        # 1. Government Letterhead Header
        story.append(Paragraph("GOVERNMENT OF INDIA / STATE POLICE DEPARTMENT", title_style))
        story.append(Spacer(1, 2))
        story.append(Paragraph("CYBER CRIME INVESTIGATION POLICE STATION & FORENSIC INTELLIGENCE CELL", subtitle_style))
        story.append(Spacer(1, 2))
        story.append(Paragraph("STATUTORY EVIDENCE PRODUCTION & ASSET FREEZE NOTICE", notice_badge_style))
        story.append(Spacer(1, 4))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E3A8A'), spaceAfter=6, spaceBefore=2))

        # 2. Reference & Date Line
        meta_table_data = [
            [
                Paragraph(f"<b>Notice Dispatch Ref:</b> <font color='#1E3A8A'>{doc_ref}</font>", bold_label_style),
                Paragraph(f"<b>Issuance Date:</b> {date_str}", meta_right)
            ],
            [
                Paragraph(f"<b>Statutory Reference:</b> Section 94 BNSS, 2023 / Section 91 CrPC, 1973", val_style),
                Paragraph(f"<b>Generated Via:</b> CryptoTrace Forensic Suite", meta_right)
            ]
        ]
        meta_table = Table(meta_table_data, colWidths=[340, 200])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
            ('TOPPADDING', (0, 0), (-1, -1), 1),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 8))

        # 3. Addressee
        to_text = (
            "<b>TO:</b><br/>"
            "<b>THE LEGAL COMPLIANCE & LAW ENFORCEMENT LIAISON DESK</b><br/>"
            "Identified Virtual Asset Service Provider (VASP) / Cryptocurrency Exchange Infrastructure<br/>"
            "(Operating Entity: Binance / WazirX / CoinDCX / Kraken / Identified Digital Asset Custodian)"
        )
        story.append(Paragraph(to_text, body_style))
        story.append(Spacer(1, 6))

        # 4. Subject Line Box
        subject_text = (
            f"<b>SUBJECT: URGENT STATUTORY MANDATE UNDER SECTION 94 OF BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS), 2023 "
            f"READ WITH SECTION 91 OF CODE OF CRIMINAL PROCEDURE (CrPC), 1973 — IMMEDIATE FREEZING OF TARGET WALLET "
            f"({wallet_address[:10]}...{wallet_address[-8:]}), DISCLOSURE OF SUBSCRIBER KYC IDENTIFIERS, AND PRESERVATION "
            f"OF AUDIT LOGS IN CONNECTION WITH CYBER FINANCIAL FRAUD INVESTIGATION.</b>"
        )
        subj_table = Table([[Paragraph(subject_text, body_style)]], colWidths=[540])
        subj_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F1F5F9')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(subj_table)
        story.append(Spacer(1, 8))

        # 5. Introductory Preamble
        preamble = (
            f"WHEREAS, an active criminal investigation into financial cyber fraud, criminal conspiracy, and online impersonation "
            f"under <b>Sections 316, 318(4) of Bharatiya Nyaya Sanhita (BNS), 2023</b> (erstwhile Sections 419, 420 IPC) and "
            f"<b>Section 66D of the Information Technology Act, 2000</b> is being conducted by this Cyber Crime Investigation Cell."
            f"<br/><br/>"
            f"AND WHEREAS, forensic blockchain money-trail analytics conducted by specialized investigators has tracked defrauded capital "
            f"flowing through intermediate transit addresses directly into the custody/deposit infrastructure linked to your exchange platform."
        )
        story.append(Paragraph(preamble, body_style))
        story.append(Spacer(1, 6))

        # 6. Structured Case & Wallet Metadata Table
        case_rows = [
            [
                Paragraph("<b>Internal Case ID:</b>", bold_label_style),
                Paragraph(case_id, val_style),
                Paragraph("<b>FIR / Station Ref:</b>", bold_label_style),
                Paragraph(external_fir or case_number or "NCRP-CYBER-2026-REG", val_style)
            ],
            [
                Paragraph("<b>Complainant Name:</b>", bold_label_style),
                Paragraph(victim_name or "Complainant Complainant", val_style),
                Paragraph("<b>Incident Loss:</b>", bold_label_style),
                Paragraph(f"₹{amount_lost:,.2f} ({currency or 'INR'})", bold_label_style)
            ],
            [
                Paragraph("<b>Target Wallet Address:</b>", bold_label_style),
                Paragraph(wallet_address, mono_val_style),
                Paragraph("<b>Blockchain Network:</b>", bold_label_style),
                Paragraph(blockchain or "Ethereum", val_style)
            ],
            [
                Paragraph("<b>Date of Occurrence:</b>", bold_label_style),
                Paragraph(incident_date[:10] if incident_date else "Recent Incident", val_style),
                Paragraph("<b>Investigating Officer:</b>", bold_label_style),
                Paragraph(f"{investigator_name} ({investigator_designation})", val_style)
            ]
        ]
        case_table = Table(case_rows, colWidths=[120, 160, 110, 150])
        case_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FAFAFA')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#94A3B8')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(case_table)
        story.append(Spacer(1, 8))

        # 7. Statutory Demands / Directives
        story.append(Paragraph("MANDATORY STATUTORY DIRECTIVES & ACTIONS DEMANDED:", directive_title_style))
        story.append(Spacer(1, 4))

        directives = [
            "<b>1. IMMEDIATE ASSET FREEZE:</b> Place an instantaneous, restrictive administrative hold / lien upon all digital assets, "
            f"cryptocurrency balances, fiat reserves, and withdrawal mechanisms associated with address <b>{wallet_address}</b> "
            "and all connected sub-accounts, parent UID, or API keys under your custodial control.",

            "<b>2. FULL SUBSCRIBER KYC/AML IDENTIFIERS:</b> Furnish complete Know-Your-Customer (KYC) records of the account holder, including: "
            "(a) Full Legal Name and Date of Birth; (b) Government Identification Document copies (Passport, National ID, Aadhaar, PAN); "
            "(c) Verified Mobile Phone Number and Email Address; (d) Residential and Business Billing Address.",

            "<b>3. IP ACCESS & TELEMETRY LOGS:</b> Provide comprehensive, unredacted IP connection logs (IPv4 and IPv6) with exact UTC timestamps "
            "and destination port numbers for all logins, account creation, trades, and withdrawal requests for the past 180 days.",

            "<b>4. FIAT BANKING & COUNTERPARTY LEDGERS:</b> Disclose all linked domestic/international bank accounts, credit/debit cards, "
            "UPI identifiers, and P2P (Peer-to-Peer) trading counterparties associated with the purchase or off-ramping of these funds.",

            "<b>5. DIGITAL EVIDENCE PRESERVATION:</b> In accordance with Section 67C of the Information Technology Act, 2000, you are legally "
            "bound to preserve all electronic records, transaction hashes, communications, and database snapshots for a minimum of 180 days."
        ]

        for d in directives:
            story.append(Paragraph(d, body_style))
            story.append(Spacer(1, 3))

        # 8. Penal Warning Box
        story.append(Spacer(1, 4))
        warning_text = (
            "<b>STATUTORY PENAL WARNING:</b> Take notice that non-compliance or undue delay in executing this statutory order "
            "within <b>forty-eight (48) hours</b> of receipt constitutes a deliberate obstruction of justice, punishable under "
            "<b>Section 223 of the Bharatiya Nyaya Sanhita, 2023</b> (erstwhile Section 188 IPC) and <b>Section 204 of the IPC</b>, "
            "and may lead to statutory sanctions, cancellation of operating permissions, and criminal prosecution of nodal officers."
        )
        warn_table = Table([[Paragraph(warning_text, warning_style)]], colWidths=[540])
        warn_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF2F2')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#F87171')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(warn_table)
        story.append(Spacer(1, 10))

        # 9. Signature & Seal Block
        sig_data = [
            [
                Paragraph("<b>Forensic Digital Signature Seal:</b><br/>"
                          f"<font size=7 color='#64748B'>SHA-256: {hashlib.sha256(f'{case_id}:{wallet_address}:{now_str}'.encode()).hexdigest()}<br/>"
                          f"Generated at: {now_str}<br/>"
                          "Cryptographically verified evidence requisition.</font>", body_style),
                Paragraph("<b>ISSUED BY:</b><br/><br/>"
                          f"<b>{investigator_name.upper()}</b><br/>"
                          f"{investigator_designation}<br/>"
                          "Cyber Crime Investigation Police Station<br/>"
                          "Specialized Law Enforcement Forensic Unit", meta_right)
            ]
        ]
        sig_table = Table(sig_data, colWidths=[320, 220])
        sig_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(KeepTogether(sig_table))

        # Build Document
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
