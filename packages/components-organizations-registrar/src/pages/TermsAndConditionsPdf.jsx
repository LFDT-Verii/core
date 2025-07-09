import { Document, Page, Text, Font, StyleSheet, View, Link } from '@react-pdf/renderer';
import inter300 from '../fonts/inter-v12-latin-300.ttf';
import inter400 from '../fonts/inter-v12-latin-regular.ttf';
import inter500 from '../fonts/inter-v12-latin-500.ttf';
import inter600 from '../fonts/inter-v12-latin-600.ttf';

import theme from '../theme/theme';

Font.register({
  family: 'Inter',
  fonts: [
    { src: inter300, fontWeight: 300 },
    { src: inter400, fontWeight: 400 },
    { src: inter500, fontWeight: 500 },
    { src: inter600, fontWeight: 600 },
  ],
});

const TermsAndConditionsPdf = () => {
  return (
    <Document>
      <Page size="A4" style={styles.container}>
        <Text style={styles.title}>VELOCITY NETWORK™ REGISTRAR TERMS OF USE</Text>
        <Text style={styles.subtitle}>Last updated: January 2023</Text>
        <Text style={styles.text}>
          These terms of use (these <Text style={styles.bold}>“Terms of Use”</Text>) are a legal
          agreement between you and Velocity Network Foundation®, a Delaware nonprofit nonstock
          corporation (<Text style={styles.bold}>“Foundation”</Text>
          ). These Terms of Use specify the terms under which you may access and use Foundation’s
          Velocity Network™ Registration UI (the <Text style={styles.bold}>“Registrar”.</Text>)
        </Text>
        <Text style={styles.text}>
          PLEASE READ THESE TERMS OF USE CAREFULLY BEFORE ACCESSING OR USING THE REGISTRAR. BY
          ACCESSING OR USING THE REGISTRAR, CLICKING “I AGREE,” OR OTHERWISE MANIFESTING YOUR ASSENT
          TO THESE TERMS OF USE, YOU AGREE TO BE BOUND BY THESE TERMS OF USE.
        </Text>
        <Text style={styles.text}>
          IF YOU ARE USING THE REGISTRAR ON BEHALF OF AN ORGANIZATION, YOU REPRESENT AND WARRANT
          THAT YOU ARE AUTHORIZED TO ACCEPT THE TERMS AND CONDITIONS OF THIS AGREEMENT ON SUCH
          ORGANIZATION’S BEHALF AND THAT SUCH ORGANIZATION AGREES TO BE RESPONSIBLE TO US IF YOU OR
          SUCH ENTITY VIOLATES THESE TERMS OF USE.
        </Text>
        <Text style={styles.text}>
          WE RESERVE ALL RIGHTS TO CHANGE OR MODIFY THESE TERMS OF USE AT ANY TIME AND FOR ANY
          REASON, AT OUR SOLE DISCRETION. UNLESS EXPLICITLY STATED OTHERWISE, ANY NEW FEATURES THAT
          AUGMENT OR ENHANCE THE CURRENT REGISTRAR SHALL BE SUBJECT TO TERMS OF USE. YOUR CONTINUED
          USE OF THE REGISTRAR AFTER ANY SUCH CHANGES CONSTITUTES YOUR ACCEPTANCE OF THE REVISED
          TERMS OF USE.
        </Text>
        <Text style={styles.text}>
          IF YOU DO NOT AGREE WITH ANY OF THE TERMS AND CONDITIONS OF THESE TERMS OF USE, YOU MAY
          NOT ACCESS OR OTHERWISE USE THE REGISTRAR.
        </Text>
        <View>
          <Text style={styles.sectionTitle}>1. USE OF THE REGISTRAR</Text>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{1.1}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                Use of the Registrar. Integrating into Velocity Network™ requires registering your
                organization through the Registrar. The Velocity Network™ is open to all
                organizations that meet the criteria set by the Foundation and agree to be bound by
                these Terms of Use. However, some roles within the Velocity Network require a
                separate application and execution of a respective participation agreement (in
                addition to the acceptance of these Terms of Use). See:&nbsp;
                <Link href="https://www.velocitynetwork.foundation/main2/connecting-to-the-network">
                  https://www.velocitynetwork.foundation/main2/connecting-to-the-network
                </Link>
                .
              </Text>
              <Text style={styles.text}>
                The Foundation grants you a personal, limited, non-exclusive, revocable,
                non-sublicensable and non-transferable right and license to access and use the
                Registrar solely for your personal, internal business use, conditioned on your
                continued compliance with all provisions of these Terms of Use (including, without
                limitation, any external terms and documentation linked or referenced herein). The
                limited license granted herein does not grant you any intellectual property license
                or rights in or to the Registrar or any of its components except as provided in
                these Terms of Use. Velocity Network Foundation reserves all rights not granted in
                these Terms of Use.
              </Text>
              <Text style={styles.text}>
                YOU AGREE THAT YOU ARE SOLELY RESPONSIBLE FOR YOUR CONDUCT WHILE ACCESSING OR USING
                THE REGISTRAR. YOU AGREE NOT TO MISUSE THE REGISTRAR. ANY USE OF THE REGISTRAR OTHER
                THAN AS SPECIFICALLY AUTHORIZED HEREIN, WITHOUT OUR PRIOR WRITTEN PERMISSION, IS
                STRICTLY PROHIBITED AND WILL TERMINATE THE LICENSE GRANTED HEREIN.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{1.2}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                Account Setup and Registration. In order to access the Registrar, you should have
                received an email from{' '}
                <Link href="mailto:support@velocitynetwork.foundation">
                  support@velocitynetwork.foundation
                </Link>{' '}
                after you have set up an administrative account with the Foundation (
                <Text style={styles.bold}>“Account”</Text>
                ). You represent that all data and information submitted via the Account and the
                Registrar (“User Data”), and will thereafter remain, complete and accurate. You
                shall be responsible and liable for all activities that occur under or in the
                Account. You are required to keep login information strictly confidential and not
                share such information with any unauthorized person.
              </Text>
              <Text style={styles.text}>
                YOU UNDERSTAND THAT YOU ARE RESPONSIBLE FOR ALL USER DATA INPUTTED OR UPLOADED TO
                THE REGISTRAR BY YOU OR ON YOUR BEHALF.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{1.3}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                Compliance with Applicable Laws. You may only use the Registrar in compliance with
                all Applicable Laws, including without limitation privacy laws, intellectual
                property laws and export and re-export control laws and regulations.
                &apos;Applicable Law&apos; or &apos;Law&apos; in this Agreement means all local,
                state, national and international laws, statutes, rules, regulations.
              </Text>
            </View>
          </View>
        </View>
        <View>
          <Text style={styles.sectionTitle}>2. Restrictions; Ownership</Text>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{2.1}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Restrictions</Text>. You shall not do or permit or
                encourage any of the following license restrictions (in whole or in part): (a) copy,
                “frame” or “mirror” the Registrar; (b) sell, assign, transfer, lease, rent,
                sublicense, or otherwise distribute or make available the Registrar to any third
                party; (c) publicly perform, display or communicate the Registrar; (d) modify,
                alter, adapt, arrange, or translate the Registrar; (e) systematically collect any
                data from the Registrar (by scraping or otherwise), attempt to re-identify
                de-identified data from the Registrar, decompile, disassemble, decrypt, reverse
                engineer, extract, or otherwise attempt to discover the source code or non-literal
                aspects (such as the underlying structure, sequence, organization, file formats,
                non-public APIs, ideas, or algorithms) of, the Registrar; (f) remove, alter, or
                conceal any copyright, trademark, or other proprietary rights notices displayed on
                or in the Registrar; (g) circumvent, disable or otherwise interfere with
                security-related or technical features or protocols of the Registrar; (h) make a
                derivative work of the Registrar, or use it to develop any service or product that
                is the same as (or substantially similar to) it; (i) store or transmit any robot,
                malware, Trojan horse, spyware, or similar malicious item intended (or that has the
                potential) to damage or disrupt the Registrar; (j) employ any hardware, software,
                device, or technique to pool connections or reduce the number of licenses, servers,
                nodes, or users that directly access or use the Registrar (sometimes referred to as
                ‘virtualization’, ‘multiplexing’ or ‘pooling’) in order to circumvent the
                restrictions on use contained herein or, if applicable, the Subscription Scope; (k)
                forge or manipulate identifiers in order to disguise the origin of any data or
                content inputted or uploaded to, or transmitted through, the Registrar; (l) take any
                action that imposes or may impose (as determined in Foundation’s reasonable
                discretion) an unreasonable or disproportionately large load on the servers,
                network, bandwidth, or other cloud infrastructure which operate or support the
                Registrar, or otherwise systematically abuse or disrupt the integrity of such
                servers, network, bandwidth, or infrastructure; or (m) exceed the Subscription
                Scope, if applicable, or otherwise access or use the Registrar other than as
                expressly permitted herein or in the applicable Agreement.
              </Text>
              <Text style={styles.text}>
                <Text style={styles.bold}>Ownership</Text>. Foundation reserves all rights, title
                and interest in and to the Registrar and all related software and technology, as
                well as all improvements and modifications to and derivative works of any of the
                foregoing, together with all related intellectual property rights. No rights are
                granted to you, whether by implied license, estoppel, operation of law or otherwise,
                other than the limited license expressly set forth above. Without limiting the
                foregoing, Foundation (and/or its licensors, as applicable) is, and shall be, the
                sole and exclusive owner of all right, title and interest in and to (i) the
                Registrar, all content appearing therein, all related software and technology, and
                all intellectual property rights in the foregoing; (iii) and any suggestions,
                feedback, comments or other input related to the Registrar, or any enhancements,
                improvements, modifications or derivative works of the Registrar that are provided
                by you (“Feedback”).
              </Text>
              <Text style={styles.text}>
                You hereby irrevocably assign to Foundation any rights that you may have in any of
                the foregoing and shall make all assignments and/or waivers necessary or reasonably
                requested by Foundation to ensure and/or provide Foundation (and/or its designee(s))
                the ownership rights set forth in this paragraph. Foundation shall not be required
                to make any payment or provide any royalty or attribution to you or any third party
                in connection with any such assignment.
              </Text>
            </View>
          </View>
        </View>
        <View>
          <Text style={styles.sectionTitle}>3. Privacy and Security</Text>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{3.1}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>User Data</Text>. As between you and Foundation, you are,
                and shall be, the sole and exclusive owner of all User Data. You hereby grant the
                Foundation and its affiliates a worldwide, non-exclusive right and license to access
                and use the User Data in connection with Foundation’s performance of its obligations
                hereunder. Any User Data collected from users of the Registrar will be subject to
                Foundation’s <Link href="/privacy-policy">Privacy Policy</Link> which is hereby
                incorporated herein by reference.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{3.2}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Security</Text>. Foundation will undertake all reasonable
                security measures required in accordance with applicable privacy and security
                regulations, to protect User Data. Notwithstanding the above, Foundation shall not
                be responsible for any Security Incident or other loss, destruction, alteration,
                unauthorized disclosure or corruption of User Data caused by you, any third party
                acting on your behalf, or anything outside of Foundation’s reasonable control.
                Foundation will (i) use commercially reasonable efforts to notify you of any
                Security Incident within a reasonable time of becoming aware of such Security
                Incident; (ii) take measures and actions as are reasonably necessary to remedy or
                mitigate the effects of such Security Incident; and (iii) keep you informed of
                developments in connection with the Security Incident.
              </Text>
            </View>
          </View>
        </View>
        <View>
          <Text style={styles.sectionTitle}>4. Disclaimers</Text>
          <Text style={styles.text}>
            THE REGISTRAR IS PROVIDED AND MADE AVAILABLE HEREUNDER ON AN “AS IS” AND “AS AVAILABLE”
            BASIS, AND, TO THE MAXIMUM EXTENTR PERMITTED BY LAW, ALL EXPRESS, IMPLIED AND STATUTORY
            CONDITIONS, WARRANTIES AND REPRESENTATIONS (INCLUDING WITHOUT LIMITATION ANY IMPLIED
            CONDITIONS OR WARRANTIES OR REPRESENTATIONS OF MERCHANTABILITY, SATISFACTORY QUALITY,
            FITNESS FOR A PARTICULAR PURPOSE, TITLE, QUIET POSSESSION, NON-INFRINGEMENT, OR QUALITY
            OF THE REGISTRAR, OR THAT OTHERWISE ARISE FROM A COURSE OF PERFORMANCE OR USAGE OF
            TRADE) ARE HEREBY DISCLAIMED. FOUNDATION AND ITS AFFILIATES DO NOT MAKE ANY
            REPRESENTATION, WARRANTY, GUARANTEE OR CONDITION REGARDING THE REGISTRAR, INCLUDING
            WITHOUT LIMITATION, THAT (i) THE REGISTRAR WILL MEET YOUR REQUIREMENTS, (ii) THE
            REGISTRAR WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE, (iii) THE RESULTS THAT
            MAY BE OBTAINED FROM THE USE OF THE REGISTRAR WILL BE ACCURATE OR RELIABLE, (iv) THE
            QUALITY OF ANY PRODUCTS, SERVICES, INFORMATION, OR OTHER MATERIAL PURCHASED OR OBTAINED
            BY YOU THROUGH THE REGISTRAR WILL MEET YOUR EXPECTATIONS, (V) ANY ERRORS IN THE SOFTWARE
            WILL BE CORRECTED, AND (VI) AS REGARDS TO COMPLIANCE WITH ANY LAWS OR REGULATIONS.
            FOUNDATION WILL NOT BE LIABLE FOR DELAYS, INTERRUPTIONS, SERVICE FAILURES OR OTHER
            PROBLEMS INHERENT IN USE OF THE INTERNET AND ELECTRONIC COMMUNICATIONS OR FOR ISSUES
            RELATED TO PUBLIC NETWORKS OR HOSTING PROVIDERS.
          </Text>
        </View>
        <View>
          <Text style={styles.sectionTitle}>5. Limitation of Liability</Text>
          <Text style={styles.text}>
            EXCEPT FOR GROSS NEGLIGENCE OR WILLFUL MISCONDUCT, IN NO EVENT SHALL THE FOUNDATION, ITS
            AFFILIATES, SUPPLIERS, OR LICENSORS BE LIABLE TO YOU FOR ANY DIRECT, INDIRECT,
            CONSEQUENTIAL, SPECIAL, INCIDENTAL, OR PUNITIVE DAMAGES; ANY LOSS OF PROFITS, BUSINESS,
            OPPORTUNITY, REVENUE, CONTRACTS, ANTICIPATED SAVINGS, OR WASTED EXPENDITURE; ANY LOSS
            OF, OR DAMAGE TO, DATA, INFORMATION SYSTEMS, REPUTATION, OR GOODWILL; AND/OR THE COST OF
            PROCURING ANY SUBSTITUTE GOODS OR SERVICES. THE FOREGOING EXCLUSIONS AND LIMITATIONS SET
            OUT IN THIS SECTION (LIMITATION OF LIABILITY) SHALL APPLY: (A) TO THE MAXIMUM EXTENT
            PERMITTED BY APPLICABLE LAW; (B) EVEN IF FOUNDATION OR ITS AFFILIATES HAVE BEEN ADVISED,
            OR SHOULD HAVE BEEN AWARE, OF THE POSSIBILITY OF LOSSES, DAMAGES, OR COSTS; AND (C)
            REGARDLESS OF THE THEORY OR BASIS OF LIABILITY, AND WHETHER IN CONTRACT, TORT (INCLUDING
            WITHOUT LIMITATION FOR NEGLIGENCE OR BREACH OF STATUTORY DUTY), MISREPRESENTATION,
            RESTITUTION, OR OTHERWISE.
          </Text>
        </View>
        <View>
          <Text style={styles.sectionTitle}>6. Indemnification</Text>
          <Text style={styles.text}>
            In the event a third party makes or institutes any claim, action, or proceeding against
            Foundation or any of its Affiliates that arises from or relates to (i) your use of the
            Registrar, (ii) breach by you of these Terms of Use, (iii) your gross negligence or
            willful misconduct, or (iv) if applicable, any User Data, you shall: (a) at your own
            expense, defend against the claim; and (b) indemnify and hold harmless Foundation and/or
            its Affiliates for any amount finally awarded against or imposed upon Foundation or its
            affiliates (or otherwise agreed in settlement) under the claim. In such a case, the
            Foundation will provide you with written notice of such claim, suit or action.
          </Text>
        </View>
        <View>
          <Text style={styles.sectionTitle}>7. Binding Arbitration and Class Action Waiver x</Text>
          <Text style={styles.text}>
            PLEASE READ THE FOLLOWING SECTION CAREFULLY BECAUSE IT REQUIRES YOU TO ARBITRATE CERTAIN
            DISPUTES AND CLAIMS WITH Velocity Network Foundation AND LIMITS THE MANNER IN WHICH YOU
            CAN SEEK RELIEF FROM US.
          </Text>
          <Text style={styles.text}>
            (b) Arbitration shall be conducted pursuant to the American Arbitration Association’s
            Consumer Arbitration Rules before a single arbitrator licensed to practice law in the
            state in which We have Our principal place of business and who is familiar with credit
            reporting law (if such expertise is applicable to the dispute). The arbitrator shall
            provide written findings of fact and conclusions of law. Each Party shall pay its own
            costs and attorneys’ fees, if any, unless the arbitrator rules otherwise based on a
            statute that affords the prevailing party attorneys’ fees and costs, in which case the
            arbitrator shall apply the same standards a court would apply to such an award. No Party
            shall be required to pay any fee or cost that such Party would not be required to pay in
            a state or federal court action. The Parties agree that the decision of the arbitrator
            shall be final and binding and not subject to appeal, reconsideration or further review,
            except as specifically provided by 9 U.S.C. §§ 10 or 11. An award in one arbitration
            proceeding shall not be precedential or binding in any way in a subsequent proceeding,
            unless the subsequent proceeding concerns identical Parties and issues to the prior
            proceeding. The Parties are entitled to representation by an attorney or other
            representative of their choosing in any arbitration. The arbitrator shall issue a
            written award stating the essential findings and conclusions on which such award is
            based. The Parties agree to abide by and perform any valid award rendered by the
            arbitrator, and judgment on the award may be entered in any court having jurisdiction
            thereof.
          </Text>
          <Text style={styles.text}>
            (c) TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, YOU WAIVE AND AGREE NOT TO BRING
            ANY RIGHT TO BRING A CLAIM ON BEHALF OF PERSONS OTHER THAN YOURSELF, OR TO OTHERWISE
            PARTICIPATE WITH OTHER PERSONS IN, ANY CLASS, COLLECTIVE, OR REPRESENTATIVE ACTION. The
            arbitrator may not certify or otherwise preside over any form of a class, collective, or
            representative proceeding, nor may the arbitrator consolidate the claims of multiple
            Persons into one proceeding. You also agree not to assert claims against Us or Our
            representatives, affiliates, insurers, successors or assigns in the same proceeding as
            any other Person, whether by joinder or otherwise, and that any proceeding brought on
            behalf of multiple claimants or plaintiffs shall be severed into individual proceedings.
            You further agree to affirmatively “opt out” and to take all other reasonable measures
            to exclude Yourself from any representative proceeding in which You may be invited to
            join or otherwise permitted to participate.
          </Text>
          <Text style={styles.text}>
            For a copy of the AAA Rules, to file a claim or for other information about the AAA,
            contact the AAA at <Link href="https://www.adr.org/">www.adr.org</Link>.
          </Text>
          <Text style={styles.text}>
            This arbitration provision shall survive the termination of the Services or of this
            Agreement. If any portion of this arbitration provision is deemed invalid or
            unenforceable, the remaining portions shall remain in force.
          </Text>
        </View>
        <View>
          <Text style={styles.sectionTitle}>8. Miscellaneouss</Text>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{8.1}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Changes to these Terms of Use</Text>. Foundation reserves
                the right to revise and update these Terms of Use from time to time in its sole
                discretion. Please take a look at the “LAST UPDATED” legend at the top of this page
                to see when these Terms of Use were last revised. Any such revision or modification
                will become effective immediately upon posting of the revised Terms of Use on the
                Registrar.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{8.2}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Assignment</Text>. These Terms of Use may not be assigned,
                in whole or in part, by you without the prior express written consent of Foundation.
                Any prohibited assignment will be null and void. Subject to the provisions of this
                Section (Assignment), these Terms of Use will bind and benefit each party and its
                respective permitted successors and assigns.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{8.3}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Governing Law</Text>. These Terms of Use and your use of
                the Registrar shall be governed by, and construed in accordance with, the laws of
                New York, without regard to any conflicts of laws rules or principles.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{8.4}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Venue</Text>. Any dispute between the parties hereto that
                is not subject to arbitration or cannot be heard in small claims court, shall be
                resolved in the state or federal courts of the State of New York and the United
                States, respectively, sitting in the State of New York, and you hereby irrevocably
                submit to personal jurisdiction in such courts, and waive any defense of
                inconvenient forum.
              </Text>
              <Text style={styles.text}>
                Notwithstanding the foregoing, Velocity Network Foundation may seek injunctive
                relief in any court of competent jurisdiction.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{8.5}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Severability</Text>. If any provision of these Terms of
                Use is held by a court of competent jurisdiction to be illegal, invalid or
                unenforceable, then: (a) the remaining provisions shall remain in full force and
                effect; and (b) such provision will be ineffective solely as to such jurisdiction
                (and only to the extent and for the duration of such illegality, invalidity or
                unenforceability), and will be substituted (in respect of such jurisdiction) with a
                valid, legal and enforceable provision that most closely approximates the original
                legal intent and economic impact of such provision.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{8.6}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Waiver and Remedies</Text>. No failure or delay on the
                part of either party in exercising any right or remedy hereunder will operate as a
                waiver thereof, nor will any single or partial exercise of any such right or remedy
                preclude any other or further exercise thereof, or the exercise of any other right
                or remedy. Any waiver granted hereunder must be in writing, duly signed by the
                waiving party, and will be valid only in the specific instance in which given.
                Except as may be expressly provided otherwise herein, no right or remedy conferred
                upon or reserved by either party hereunder is intended to be, or will be deemed,
                exclusive of any other right or remedy hereunder, at law, or in equity, but will be
                cumulative of such other rights and remedies.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{8.7}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Relationship</Text>. The relationship between you and the
                Foundation is solely that of independent contractors, neither party nor its
                employees are the servants, agents, or employees of the other, and no exclusivities
                arise hereunder. Nothing herein shall be construed to create a relationship of
                employer and employee, principal and agent, joint venture, partnership, association,
                or otherwise between the parties. Neither party has any authority to enter into
                agreements of any kind on behalf of the other party, and neither party will create
                or attempt to create any obligation, express or implied, on behalf of the other
                party.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer} wrap={false}>
            <Text style={styles.sectionNumber}>{8.8}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Force Majeure</Text>. If Foundation’s performance
                (excluding payment obligations) hereunder is prevented, hindered, or delayed by
                reason of an event of Force Majeure (defined below), Foundation shall be excused
                from such performance to the extent that, and for so long as, performance is
                prevented, interrupted, or delayed thereby, provided that Foundation shall promptly
                notify you of the occurrence of such event. If and when performance is resumed, all
                dates specified herein and/or in any Order Form, if applicable, shall be
                automatically adjusted to reflect the period of such prevention, interruption, or
                delay by reason of such event of Force Majeure. For purposes of these Terms of Use,
                “Force Majeure” means: (a) fire, flood, earthquake, explosion, pandemic or epidemic
                (or similar regional health crisis; including COVID-19), or act of God; (b) strikes,
                lockouts, picketing, concerted labor action, work stoppages, other labor or
                industrial disturbances, or shortages of materials or equipment, not the fault of
                either party; (c) invasion, war (declared or undeclared), terrorism, riot, or civil
                commotion; (d) an act of governmental or quasi-governmental authorities; (e) failure
                of the internet or any public telecommunications network, hacker attacks, denial of
                service attacks, virus or other malicious software attacks or infections, shortage
                of adequate power or transportation facilities; and/or (f) any matter beyond the
                reasonable control of Foundation.
              </Text>
            </View>
          </View>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionNumber}>{8.9}</Text>
            <View style={styles.sectionText}>
              <Text style={styles.text}>
                <Text style={styles.bold}>Contact</Text>. If you have any questions (or comments)
                concerning these Terms of Use, you are welcome to send us an email at:{' '}
                <Link href="mailto:support@velocitynetwork.foundation">
                  support@velocitynetwork.foundation
                </Link>{' '}
                and we will make an effort to reply within a reasonable timeframe.
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: '62px',
    paddingBottom: '140px',
    paddingLeft: '20px',
    paddingRight: '20px',
    maxWidth: '67.71%',
    color: theme.palette.text.primary,
  },
  title: {
    marginBottom: 30,
    fontWeight: 600,
    fontFamily: 'Inter',
    fontSize: 24,
    maxWidth: '90%',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: 400,
    textTransform: 'uppercase',
    marginBottom: 51,
  },
  text: {
    fontWeight: 400,
    fontFamily: 'Inter',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: '1.5',
  },
  bold: {
    fontWeight: 600,
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 18,
    fontFamily: 'Inter',
    marginTop: 50,
    marginBottom: 20,
  },
  sectionContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'nowrap',
  },
  sectionNumber: {
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 16,
    width: '10%',
  },
  sectionText: {
    width: '90%',
  },
});

export default TermsAndConditionsPdf;
