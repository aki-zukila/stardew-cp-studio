from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from types import SimpleNamespace

from backend.app.ai_service import get_ai_config, save_ai_config, suggest_with_ai
from backend.app.exporter import export_content_pack
from backend.app.main import get_session, update_session
from backend.app import item_catalog
from backend.app.models import AISuggestRequest, GameDataEntry, PatchEntry, SaveAIConfigRequest, SessionStateUpdate
from backend.app.project_io import new_project, open_project, write_project_package
from backend.app.project_io import import_asset
from backend.app.rule_library_loader import ai_rule_context, load_rule_library
from backend.app.rules import load_ruleset
from backend.app.validator import validate_project


class CoreTests(unittest.TestCase):
    def test_session_state_can_be_read_and_updated(self):
        import asyncio

        initial = get_session()
        project = initial.project.model_copy(deep=True)
        project.manifest.Name = "Synced Pack"
        updated = asyncio.run(update_session(SessionStateUpdate(
            project=project,
            projectPath="E:/Codex/stardew-cp-studio/synced.cpgen",
            exportPath="E:/Codex/stardew-cp-studio/exports",
            clientId="test-client",
        )))

        self.assertGreater(updated.revision, initial.revision)
        self.assertEqual(updated.lastClientId, "test-client")
        self.assertEqual(updated.project.manifest.Name, "Synced Pack")
        self.assertEqual(updated.projectPath, "E:/Codex/stardew-cp-studio/synced.cpgen")

    def test_save_open_roundtrip(self):
        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.UniqueID = "Author.TestPack"
            project.patches.append(PatchEntry(name="Object edit", target="Data/Objects", fields={"Entries": {"Test": "Value"}}))
            path = Path(temp_dir) / "test.cpgen"

            write_project_package(project, str(path))
            reopened = open_project(str(path))

            self.assertEqual(reopened.manifest.Name, "Test Pack")
            self.assertEqual(reopened.patches[0].fields["Entries"]["Test"], "Value")

    def test_validate_manifest_error(self):
        project = new_project()
        result = validate_project(project)
        self.assertFalse(result.can_export)
        self.assertTrue(any(issue.path == "manifest.UniqueID" for issue in result.errors))

    def test_validate_from_file_messages_are_action_aware(self):
        project = new_project()
        project.manifest.Name = "Test Pack"
        project.manifest.UniqueID = "Author.TestPack"
        project.patches.extend([
            PatchEntry(name="Open shop tile", action="EditMap", target="Maps/Town", fields={"MapTiles": [{"Position": {"X": 1, "Y": 2}}]}),
            PatchEntry(name="Missing load asset", action="Load", target="Maps/Custom_Test"),
        ])

        result = validate_project(project)

        self.assertFalse(any(issue.path == "patches[0].from_file" for issue in result.warnings))
        load_warning = next(issue for issue in result.warnings if issue.path == "patches[1].from_file")
        self.assertIn("Missing load asset", load_warning.message)
        self.assertIn("Action=Load", load_warning.message)
        self.assertIn("Target=Maps/Custom_Test", load_warning.message)

    def test_validate_warns_duplicate_dialogue_keys(self):
        project = new_project()
        project.manifest.Name = "Test Pack"
        project.manifest.UniqueID = "Author.TestPack"
        project.game_data.extend([
            GameDataEntry(kind="dialogue", target="Characters/Dialogue/Cale", key="Mon", value="{{i18n:Cale.CharacterDialogue.Mon.a1111111}}"),
            GameDataEntry(kind="dialogue", target="Characters/Dialogue/Cale", key="Mon", value="{{i18n:Cale.CharacterDialogue.Mon.b2222222}}"),
        ])

        result = validate_project(project)

        warning = next(issue for issue in result.warnings if issue.path == "game_data[0].key")
        self.assertIn("Key=Mon", warning.message)
        self.assertIn("互相覆盖", warning.message)

    def test_export_content_pack(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.patches.extend(
                [
                    PatchEntry(action="Load", target="Data/Foo", from_file="assets/foo.json"),
                    PatchEntry(action="EditData", target="Data/Objects", fields={"Entries": {"Example": {"Name": "Example"}}}),
                    PatchEntry(action="EditImage", target="LooseSprites/Cursors", from_file="assets/cursors.png"),
                    PatchEntry(action="EditMap", target="Maps/Farm", from_file="assets/farm.tmx"),
                    PatchEntry(action="Include", from_file="assets/more-patches.json"),
                ]
            )
            project.game_data.append(GameDataEntry(kind="item", target="Data/Objects", key="ExampleItem", value={"Name": "Example"}))

            output = export_content_pack(project, temp_dir)

            self.assertTrue((output / "manifest.json").exists())
            self.assertTrue((output / "content.json").exists())
            self.assertTrue((output / "i18n" / "default.json").exists())
            self.assertEqual((output / "assets" / "blank.json").read_text(encoding="utf-8").strip(), "{}")
            content = json.loads((output / "content.json").read_text(encoding="utf-8"))
            self.assertNotIn("StardewCPStudio", json.dumps(content))

    def test_export_schedule_uses_sve_style_files(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.i18n = {"Sophia.Schedule.Mon.000": "Hello from schedule."}
            project.game_data.extend([
                GameDataEntry(
                    kind="schedule",
                    target="Characters/schedules/Sophia",
                    key="Mon",
                    value="900 Town 64 15 2 \"Strings\\\\schedules\\\\Sophia:Mon.000\"",
                    advanced={"StardewCPStudio": {"schedule": {
                        "npcName": "Sophia",
                        "points": [{"time": "900", "location": "Town", "x": 64, "y": 15, "direction": 2, "dialogueKey": "Mon.000", "dialogueText": "Hello from schedule."}],
                        "dialogueEntries": [{"key": "Mon.000", "i18nKey": "Sophia.Schedule.Mon.000"}],
                    }}},
                ),
                GameDataEntry(
                    kind="schedule",
                    target="Characters/schedules/Sophia",
                    key="rain",
                    value="900 Town 1 2 2",
                    when={"Weather": "Rain"},
                ),
            ])

            output = export_content_pack(project, temp_dir)
            characters = json.loads((output / "code" / "characters.json").read_text(encoding="utf-8"))
            schedule = json.loads((output / "assets" / "CharacterFiles" / "Schedules" / "Sophia" / "Schedule.json").read_text(encoding="utf-8"))
            schedule_dialogue = json.loads((output / "assets" / "CharacterFiles" / "Schedules" / "Sophia" / "ScheduleDialogue.json").read_text(encoding="utf-8"))

            self.assertEqual(schedule["Mon"], "900 Town 64 15 2 \"Strings\\\\schedules\\\\Sophia:Mon.000\"")
            self.assertNotIn("rain", schedule)
            self.assertTrue(any(change.get("Action") == "Load" and change.get("Target") == "Characters/schedules/Sophia" for change in characters["Changes"]))
            self.assertTrue(any(change.get("Action") == "Include" and change.get("FromFile") == "assets/CharacterFiles/Schedules/Sophia/ScheduleDialogue.json" for change in characters["Changes"]))
            rain_patch = next(change for change in characters["Changes"] if change.get("Entries", {}).get("rain") == "900 Town 1 2 2")
            self.assertEqual(rain_patch["When"], {"Weather": "Rain"})
            self.assertEqual(schedule_dialogue["Changes"][0]["Target"], "Strings/schedules/Sophia")
            self.assertEqual(schedule_dialogue["Changes"][0]["Entries"]["Mon.000"], "{{i18n:Sophia.Schedule.Mon.000}}")
            self.assertEqual(json.loads((output / "i18n" / "default.json").read_text(encoding="utf-8"))["Sophia.Schedule.Mon.000"], "Hello from schedule.")

    def test_export_animation_descriptions_to_character_code(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.game_data.append(
                GameDataEntry(
                    kind="animation",
                    target="Data/animationDescriptions",
                    key="pufferbob_sleep",
                    value="50/50/50",
                    advanced={"StardewCPStudio": {"animation": {"npcName": "Pufferbob", "isSleep": True}}},
                )
            )

            output = export_content_pack(project, temp_dir)
            characters = json.loads((output / "code" / "characters.json").read_text(encoding="utf-8"))
            patch = next(change for change in characters["Changes"] if change.get("Target") == "Data/animationDescriptions")
            self.assertEqual(patch["Entries"], {"pufferbob_sleep": "50/50/50"})
            self.assertNotIn("StardewCPStudio", json.dumps(characters))

    def test_export_mail_newlines_and_trigger_actions_are_separate(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.game_data.extend([
                GameDataEntry(
                    kind="mail",
                    target="Data/Mail",
                    key="LetterFromGodOfDeath",
                    value={
                        "Body": "第一行\n第二行",
                        "Title": "标题",
                        "Actions": ["AddMail Current WrongPlace"],
                    },
                ),
                GameDataEntry(
                    kind="trigger_action",
                    target="Data/TriggerActions",
                    key="give_LCF_LetterFromGodOfDeath",
                    value={
                        "Id": "LCF_LetterFromGodOfDeath",
                        "Trigger": "DayStarted",
                        "Actions": ["AddMail Current LetterFromGodOfDeath"],
                    },
                    when={"Day": 1},
                ),
            ])

            output = export_content_pack(project, temp_dir)
            mail_file = json.loads((output / "code" / "mail.json").read_text(encoding="utf-8"))
            mail_patch = next(change for change in mail_file["Changes"] if change.get("Target") == "Data/Mail")
            trigger_patch = next(change for change in mail_file["Changes"] if change.get("Target") == "Data/TriggerActions")

            self.assertEqual(mail_patch["Entries"]["LetterFromGodOfDeath"], "第一行^第二行[#]标题")
            self.assertNotIn("WrongPlace", mail_patch["Entries"]["LetterFromGodOfDeath"])
            self.assertEqual(trigger_patch["Entries"]["give_LCF_LetterFromGodOfDeath"]["Actions"], ["AddMail Current LetterFromGodOfDeath"])
            self.assertEqual(trigger_patch["When"], {"Day": 1})

    def test_export_quest_to_quest_code_file(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.i18n = {
                "Author.TestPack.Quest.Author.TestPack.ExampleQuest.Title": "Bring Abigail a shell",
                "Author.TestPack.Quest.Author.TestPack.ExampleQuest.Description": "Abigail asked for a shell.",
                "Author.TestPack.Quest.Author.TestPack.ExampleQuest.Hint": "Give Abigail a rainbow shell.",
                "Author.TestPack.Quest.Author.TestPack.ExampleQuest.Reaction": "Thanks!",
            }
            project.game_data.append(GameDataEntry(
                kind="quest",
                target="Data/Quests",
                key="Author.TestPack.ExampleQuest",
                value="ItemDelivery/{{i18n:Author.TestPack.Quest.Author.TestPack.ExampleQuest.Title}}/{{i18n:Author.TestPack.Quest.Author.TestPack.ExampleQuest.Description}}/{{i18n:Author.TestPack.Quest.Author.TestPack.ExampleQuest.Hint}}/Abigail (O)66/-1/350/-1/true/{{i18n:Author.TestPack.Quest.Author.TestPack.ExampleQuest.Reaction}}",
                advanced={"StardewCPStudio": {"quest": {"mode": "builder"}}},
            ))

            output = export_content_pack(project, temp_dir)
            content = json.loads((output / "content.json").read_text(encoding="utf-8"))
            quests = json.loads((output / "code" / "quests.json").read_text(encoding="utf-8"))

            self.assertTrue(any(change["Action"] == "Include" and change["FromFile"] == "code/quests.json" for change in content["Changes"]))
            self.assertEqual(
                quests["Changes"][0]["Entries"]["Author.TestPack.ExampleQuest"],
                "ItemDelivery/{{i18n:Author.TestPack.Quest.Author.TestPack.ExampleQuest.Title}}/{{i18n:Author.TestPack.Quest.Author.TestPack.ExampleQuest.Description}}/{{i18n:Author.TestPack.Quest.Author.TestPack.ExampleQuest.Hint}}/Abigail (O)66/-1/350/-1/true/{{i18n:Author.TestPack.Quest.Author.TestPack.ExampleQuest.Reaction}}",
            )
            self.assertNotIn("StardewCPStudio", json.dumps(quests))

    def test_export_filters_internal_studio_metadata(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.patches.append(PatchEntry(
                action="EditData",
                target="Data/Objects",
                fields={"Entries": {"Example": {"Name": "Example"}}},
                advanced={"StardewCPStudio": {"hidden": True}, "PublicField": "kept"},
            ))
            project.game_data.append(GameDataEntry(
                kind="npc",
                target="Data/Characters",
                key="ExampleNPC",
                value={"DisplayName": "Example"},
                advanced={"StardewCPStudio": {"npc": {"relationshipRoute": "roommate"}}, "PublicField": "kept"},
            ))

            output = export_content_pack(project, temp_dir)
            content = json.loads((output / "content.json").read_text(encoding="utf-8"))
            patches = json.loads((output / "code" / "patches.json").read_text(encoding="utf-8"))
            characters = json.loads((output / "code" / "characters.json").read_text(encoding="utf-8"))
            text = json.dumps({**content, **patches, **characters})

            self.assertNotIn("StardewCPStudio", text)
            self.assertEqual(sum(1 for change in patches["Changes"] if change.get("PublicField") == "kept"), 1)
            self.assertEqual(sum(1 for change in characters["Changes"] if change.get("PublicField") == "kept"), 1)

    def test_export_dialogue_uses_sve_style_include_files(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.i18n = {
                "Sophia.CharacterDialogue.Mon": "Hello on Monday.",
                "Sophia.CharacterDialogue.Mon4": "Four-heart Monday.",
                "Sophia.CharacterDialogue.Rain": "Rain only.",
                "Sophia.MarriageDialogue.Rainy_Day_0": "Rainy spouse line.",
                "Sophia.MarriageDialogue.Good_9": "Good spouse line.",
                "Sophia.MarriageDialogue.Rainy_Night_5": "Rainy night spouse line.",
            }
            project.game_data.extend([
                GameDataEntry(kind="dialogue", target="Characters/Dialogue/Sophia", key="Mon", value="{{i18n:Sophia.CharacterDialogue.Mon}}"),
                GameDataEntry(kind="dialogue", target="Characters/Dialogue/Sophia", key="Mon4", value="{{i18n:Sophia.CharacterDialogue.Mon4}}"),
                GameDataEntry(
                    kind="dialogue",
                    target="Characters/Dialogue/Sophia",
                    key="rainy",
                    value="{{i18n:Sophia.CharacterDialogue.Rain}}",
                    when={"Season": "spring"},
                ),
                GameDataEntry(
                    kind="dialogue",
                    target="Characters/Dialogue/MarriageDialogueSophia",
                    key="Rainy_Day_0",
                    value="{{i18n:Sophia.MarriageDialogue.Rainy_Day_0}}",
                ),
                GameDataEntry(
                    kind="dialogue",
                    target="Characters/Dialogue/MarriageDialogueSophia",
                    key="Good_9",
                    value="{{i18n:Sophia.MarriageDialogue.Good_9}}",
                ),
                GameDataEntry(
                    kind="dialogue",
                    target="Characters/Dialogue/MarriageDialogueSophia",
                    key="Rainy_Night_5",
                    value="{{i18n:Sophia.MarriageDialogue.Rainy_Night_5}}",
                ),
            ])

            output = export_content_pack(project, temp_dir)
            content = json.loads((output / "content.json").read_text(encoding="utf-8"))
            dialogue_file = output / "code" / "dialogue.json"
            dialogue = json.loads(dialogue_file.read_text(encoding="utf-8"))

            self.assertTrue(any(change["Action"] == "Include" and change["FromFile"] == "code/dialogue.json" for change in content["Changes"]))
            self.assertTrue(any(change["Action"] == "Load" and change["Target"] == "Characters/Dialogue/Sophia" and change["FromFile"] == "assets/blank.json" for change in dialogue["Changes"]))
            self.assertTrue(any(change["Action"] == "Include" and change["FromFile"] == "assets/CharacterFiles/Dialogue/Sophia/dialogue.json" for change in dialogue["Changes"]))
            self.assertTrue(any(change["Action"] == "Include" and change["FromFile"] == "assets/CharacterFiles/Dialogue/Sophia/MarriageDialogue.json" for change in dialogue["Changes"]))
            self.assertFalse(any(change["Action"] == "EditData" and change.get("Target") == "Characters/Dialogue/Sophia" for change in content["Changes"]))
            self.assertEqual(len([change for change in dialogue["Changes"] if change.get("Target") == "Characters/Dialogue/Sophia" and change["Action"] == "EditData"]), 0)
            no_when = next(change for change in json.loads((output / "assets" / "CharacterFiles" / "Dialogue" / "Sophia" / "dialogue.json").read_text(encoding="utf-8"))["Changes"] if "When" not in change)
            with_when = next(change for change in json.loads((output / "assets" / "CharacterFiles" / "Dialogue" / "Sophia" / "dialogue.json").read_text(encoding="utf-8"))["Changes"] if "When" in change)
            self.assertEqual(no_when["Entries"]["Mon"], "{{i18n:Sophia.CharacterDialogue.Mon}}")
            self.assertEqual(no_when["Entries"]["Mon4"], "{{i18n:Sophia.CharacterDialogue.Mon4}}")
            self.assertEqual(with_when["Entries"]["rainy"], "{{i18n:Sophia.CharacterDialogue.Rain}}")
            marriage = json.loads((output / "assets" / "CharacterFiles" / "Dialogue" / "Sophia" / "MarriageDialogue.json").read_text(encoding="utf-8"))
            self.assertEqual(marriage["Changes"][0]["Entries"]["Rainy_Day_0"], "{{i18n:Sophia.MarriageDialogue.Rainy_Day_0}}")
            self.assertEqual(marriage["Changes"][0]["Entries"]["Good_9"], "{{i18n:Sophia.MarriageDialogue.Good_9}}")
            self.assertEqual(marriage["Changes"][0]["Entries"]["Rainy_Night_5"], "{{i18n:Sophia.MarriageDialogue.Rainy_Night_5}}")
            self.assertFalse(any(key.endswith("_n") for key in marriage["Changes"][0]["Entries"]))

    def test_export_special_dialogue_stays_in_content_json(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.game_data.extend([
                GameDataEntry(
                    kind="custom",
                    target="Data/EngagementDialogue",
                    key="Cale0",
                    value="{{i18n:Cale.SpecialDialogue.engagement.Cale0}}",
                    advanced={"Priority": "Late", "StardewCPStudio": {"specialDialogue": {"kind": "engagement", "npcName": "Cale"}}},
                ),
                GameDataEntry(
                    kind="custom",
                    target="Characters/Dialogue/rain",
                    key="Cale",
                    value="{{i18n:Cale.SpecialDialogue.rain.Cale}}",
                    advanced={"StardewCPStudio": {"specialDialogue": {"kind": "rain", "npcName": "Cale"}}},
                ),
                GameDataEntry(
                    kind="custom",
                    target="Data/Festivals/spring13",
                    key="Cale",
                    value="{{i18n:Cale.SpecialDialogue.festival.spring13}}",
                    advanced={"StardewCPStudio": {"specialDialogue": {"kind": "festival", "npcName": "Cale"}}},
                ),
            ]) 

            output = export_content_pack(project, temp_dir)
            dialogue = json.loads((output / "code" / "dialogue.json").read_text(encoding="utf-8"))
            changes = dialogue["Changes"]

            engagement = next(change for change in changes if change.get("Target") == "Data/EngagementDialogue")
            rain = next(change for change in changes if change.get("Target") == "Characters/Dialogue/rain")
            festival = next(change for change in changes if change.get("Target") == "Data/Festivals/spring13")

            self.assertEqual(engagement["Priority"], "Late")
            self.assertEqual(engagement["Entries"]["Cale0"], "{{i18n:Cale.SpecialDialogue.engagement.Cale0}}")
            self.assertEqual(rain["Entries"]["Cale"], "{{i18n:Cale.SpecialDialogue.rain.Cale}}")
            self.assertEqual(festival["Entries"]["Cale"], "{{i18n:Cale.SpecialDialogue.festival.spring13}}")
            self.assertNotIn("StardewCPStudio", json.dumps(dialogue))

    def test_export_movie_reactions(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.game_data.append(GameDataEntry(
                kind="custom",
                target="Data/MoviesReactions",
                key="Cale",
                value={
                    "NPCName": "Cale",
                    "Reactions": [
                        {
                            "Tag": "spring_movie_0",
                            "Response": "like",
                            "Whitelist": [],
                            "SpecialResponses": {
                                "BeforeMovie": {"ResponsePoint": None, "Script": "", "Text": "Before"},
                                "DuringMovie": {"ResponsePoint": None, "Script": "/message \"Watching\"", "Text": "During"},
                                "AfterMovie": {"ResponsePoint": None, "Script": "", "Text": "After"},
                            },
                            "ID": "cale_reaction_0",
                        }
                    ],
                },
                advanced={"StardewCPStudio": {"npcModule": {"npcName": "Cale", "module": "movieReaction"}}},
            ))

            output = export_content_pack(project, temp_dir)
            content = json.loads((output / "content.json").read_text(encoding="utf-8"))
            change = next(change for change in json.loads((output / "code" / "characters.json").read_text(encoding="utf-8"))["Changes"] if change.get("Target") == "Data/MoviesReactions")

            self.assertEqual(change["Entries"]["Cale"]["NPCName"], "Cale")
            self.assertEqual(change["Entries"]["Cale"]["Reactions"][0]["Tag"], "spring_movie_0")
            self.assertEqual(change["Entries"]["Cale"]["Reactions"][0]["Response"], "like")
            self.assertNotIn("StardewCPStudio", json.dumps(change))

    def test_export_story_event_filters_builder_metadata(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.i18n = {
                "Author.TestPack.Event1.speak.node1": "你好，@。#$b#这是剧情台词。",
                "Author.TestPack.Event1.end.node2": "之后再聊吧。$h",
            }
            project.game_data.append(GameDataEntry(
                kind="event",
                name="Test Story Event",
                target="Data/Events/Farm",
                key="Author.TestPack.Event1/Time 600 1100/Weather sunny/IsHost",
                value='continue/-500 -500/farmer 95 49 2 MorrisTod 95 51 0/pause 1250/speak MorrisTod "{{i18n:Author.TestPack.Event1.speak.node1}}"/globalFade/viewport -1000 -1000/end dialogue MorrisTod "{{i18n:Author.TestPack.Event1.end.node2}}"',
                when={"HasSeenEvent |contains=5553214": True},
                advanced={"StardewCPStudio": {"storyEvent": {"location": "Farm"}}, "Priority": "Late"},
            ))

            output = export_content_pack(project, temp_dir)
            change = next(change for change in json.loads((output / "code" / "events.json").read_text(encoding="utf-8"))["Changes"] if change.get("Target") == "Data/Events/Farm")

            self.assertEqual(change["Action"], "EditData")
            self.assertEqual(change["Priority"], "Late")
            self.assertEqual(change["When"], {"HasSeenEvent |contains=5553214": True})
            self.assertIn("Author.TestPack.Event1/Time 600 1100/Weather sunny/IsHost", change["Entries"])
            self.assertIn("{{i18n:Author.TestPack.Event1.speak.node1}}", change["Entries"]["Author.TestPack.Event1/Time 600 1100/Weather sunny/IsHost"])
            self.assertNotIn("StardewCPStudio", json.dumps(change))

    def test_export_story_event_move_target_coordinates(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.game_data.append(GameDataEntry(
                kind="event",
                name="Movement Story Event",
                target="Data/Events/Farm",
                key="Author.TestPack.EventMove",
                value="continue/-500 -500/farmer 10 10 2/end",
                advanced={
                    "StardewCPStudio": {
                        "storyEvent": {
                            "actors": [{"actor": "farmer", "x": 10, "y": 10, "direction": 2}],
                            "nodes": [
                                {"kind": "move", "data": {"actor": "farmer", "targetMode": True, "targetX": 12, "targetY": 13, "direction": 2}},
                                {"kind": "warp", "data": {"actor": "farmer", "x": 20, "y": 20}},
                                {"kind": "move", "data": {"actor": "farmer", "targetMode": True, "targetX": 18, "targetY": 21, "direction": 3, "continue": True}},
                            ],
                        }
                    }
                },
            ))

            output = export_content_pack(project, temp_dir)
            change = next(change for change in json.loads((output / "code" / "events.json").read_text(encoding="utf-8"))["Changes"] if change.get("Target") == "Data/Events/Farm")

            self.assertEqual(
                change["Entries"]["Author.TestPack.EventMove"],
                "continue/-500 -500/farmer 10 10 2/move farmer 2 3 2/warp farmer 20 20/move farmer -2 1 3 true",
            )

    def test_export_secret_notes_to_other_file_with_i18n_linebreaks(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.i18n = {"Author.TestPack.SecretNote.Cale": "第一行\n第二行"}
            project.game_data.append(GameDataEntry(
                kind="secret_note",
                name="Secret Note",
                target="Data/SecretNotes",
                key="CaleNote",
                value="{{i18n:Author.TestPack.SecretNote.Cale}}",
                advanced={"StardewCPStudio": {"secretNote": {"noteId": "CaleNote", "textKey": "Author.TestPack.SecretNote.Cale"}}},
            ))

            output = export_content_pack(project, temp_dir)
            content = json.loads((output / "content.json").read_text(encoding="utf-8"))
            notes = json.loads((output / "code" / "Other" / "SecretNotes.json").read_text(encoding="utf-8"))
            i18n = json.loads((output / "i18n" / "default.json").read_text(encoding="utf-8"))

            self.assertIn("code/Other/SecretNotes.json", [change["FromFile"] for change in content["Changes"]])
            self.assertEqual(notes["Changes"][0]["Target"], "Data/SecretNotes")
            self.assertEqual(notes["Changes"][0]["Entries"]["CaleNote"], "{{i18n:Author.TestPack.SecretNote.Cale}}")
            self.assertEqual(i18n["Author.TestPack.SecretNote.Cale"], "第一行^第二行")

    def test_export_special_order_with_string_entries(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.i18n = {
                "Author.TestPack.SpecialOrder.Andy.Name": "安迪的订单",
                "Author.TestPack.SpecialOrder.Andy.Text": "帮安迪收集材料。",
                "Author.TestPack.SpecialOrder.Andy.Objective": "投入木材",
            }
            project.game_data.append(GameDataEntry(
                kind="special_order",
                name="Andy Order",
                target="Data/SpecialOrders",
                key="Andy",
                value={
                    "Name": "[Andy_Name]",
                    "Requester": "Andy",
                    "Duration": "TwoWeeks",
                    "Repeatable": "False",
                    "Text": "[Andy_Text]",
                    "Objectives": [],
                    "Rewards": [],
                },
                advanced={"StardewCPStudio": {"specialOrder": {
                    "orderId": "Andy",
                    "nameKey": "Author.TestPack.SpecialOrder.Andy.Name",
                    "textKey": "Author.TestPack.SpecialOrder.Andy.Text",
                    "requester": "Andy",
                    "duration": "TwoWeeks",
                    "repeatable": False,
                    "requiredTags": "event_5000005",
                    "orderType": "",
                    "specialRule": "",
                    "objectives": [
                        {
                            "id": "objective-1",
                            "type": "Donate",
                            "textKey": "Author.TestPack.SpecialOrder.Andy.Objective",
                            "requiredCount": "500",
                            "data": {
                                "DropBox": "AndyChest",
                                "DropBoxGameLocation": "Custom_AndyHouse",
                                "DropBoxIndicatorLocation": "12 5.5",
                                "AcceptedContextTags": "item_wood",
                            },
                        }
                    ],
                    "rewards": [{"id": "reward-1", "type": "Money", "data": {"Amount": "5362"}}],
                }}},
            ))

            output = export_content_pack(project, temp_dir)
            orders = json.loads((output / "code" / "special_orders.json").read_text(encoding="utf-8"))["Changes"]
            order_patch = next(change for change in orders if change["Target"] == "Data/SpecialOrders")
            string_patch = next(change for change in orders if change["Target"] == "Strings/SpecialOrderStrings")

            self.assertEqual(order_patch["Entries"]["Andy"]["Requester"], "Andy")
            self.assertEqual(order_patch["Entries"]["Andy"]["Objectives"][0]["Text"], "[Andy_Objective_1_Text]")
            self.assertEqual(order_patch["Entries"]["Andy"]["Rewards"][0]["Data"]["Amount"], "5362")
            self.assertEqual(string_patch["Entries"]["Andy_Name"], "{{i18n:Author.TestPack.SpecialOrder.Andy.Name}}")
            self.assertEqual(string_patch["Entries"]["Andy_Objective_1_Text"], "{{i18n:Author.TestPack.SpecialOrder.Andy.Objective}}")

    def test_export_story_event_branches_share_edit_data_patch(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.game_data.append(GameDataEntry(
                kind="event",
                name="Branching Story Event",
                target="Data/Events/Farm",
                key="Author.TestPack.Event1/IsHost",
                value='continue/-500 -500/farmer 95 49 2 MorrisTod 95 51 0/question fork0 "{{i18n:Author.TestPack.Event1.question.node1}}"/fork fork0 Author.TestPack.Event1_Branch1/end',
                advanced={
                    "StardewCPStudio": {
                        "storyEvent": {
                            "branches": [
                                {
                                    "key": "Author.TestPack.Event1_Branch1",
                                    "nodes": [
                                        {"kind": "pause", "data": {"duration": 400}},
                                        {"kind": "message", "data": {"i18nKey": "Author.TestPack.Event1.branch.message"}},
                                        {"kind": "textAboveHead", "data": {"actor": "MorrisTod", "i18nKey": "Author.TestPack.Event1.branch.bubble"}},
                                        {"kind": "faceDirection", "data": {"actor": "farmer", "direction": 1, "continue": True}},
                                        {"kind": "warp", "data": {"actor": "farmer", "x": 95, "y": 49}},
                                        {"kind": "playSound", "data": {"sound": "doorClose"}},
                                        {"kind": "animate", "data": {"actor": "MorrisTod", "flip": False, "loop": True, "frameDuration": 120, "frames": "0 1 2"}},
                                        {"kind": "showFrame", "data": {"actor": "MorrisTod", "frame": 4}},
                                        {"kind": "stopAnimation", "data": {"actor": "MorrisTod"}},
                                        {"kind": "advancedMove", "data": {"actor": "MorrisTod", "loop": False, "path": "0 3 2 0"}},
                                        {"kind": "positionOffset", "data": {"actor": "MorrisTod", "x": 1, "y": -1, "continue": True}},
                                        {"kind": "shake", "data": {"actor": "MorrisTod", "duration": 1200}},
                                        {"kind": "jump", "data": {"actor": "MorrisTod", "intensity": 8}},
                                        {"kind": "eventSeen", "data": {"eventId": "Author.TestPack.Event1", "seen": False}},
                                        {"kind": "addItem", "data": {"itemId": "(O)388", "count": 2, "quality": 0}},
                                        {"kind": "removeItem", "data": {"itemId": "(O)388", "count": 1}},
                                        {"kind": "addObject", "data": {"x": 64, "y": 15, "itemId": "(O)388"}},
                                        {"kind": "removeObject", "data": {"x": 64, "y": 15}},
                                        {"kind": "removeSprite", "data": {"x": 64, "y": 15}},
                                        {"kind": "changeLocation", "data": {"location": "Town"}},
                                        {"kind": "changeMapTile", "data": {"layer": "Buildings", "x": 64, "y": 15, "tileIndex": 123}},
                                        {"kind": "changePortrait", "data": {"npc": "MorrisTod", "portrait": "Happy"}},
                                        {"kind": "changeSprite", "data": {"actor": "MorrisTod", "sprite": "Winter"}},
                                        {"kind": "friendship", "data": {"npc": "MorrisTod", "amount": 250}},
                                        {"kind": "money", "data": {"amount": -100}},
                                        {"kind": "end", "data": {"mode": "dialogue", "actor": "MorrisTod", "i18nKey": "Author.TestPack.Event1.branch.end"}},
                                    ],
                                }
                            ]
                        }
                    }
                },
            ))

            output = export_content_pack(project, temp_dir)
            change = next(change for change in json.loads((output / "code" / "events.json").read_text(encoding="utf-8"))["Changes"] if change.get("Target") == "Data/Events/Farm")

            self.assertEqual(set(change["Entries"]), {"Author.TestPack.Event1/IsHost", "Author.TestPack.Event1_Branch1"})
            self.assertEqual(
                change["Entries"]["Author.TestPack.Event1_Branch1"],
                'pause 400/message "{{i18n:Author.TestPack.Event1.branch.message}}"/textAboveHead MorrisTod "{{i18n:Author.TestPack.Event1.branch.bubble}}"/faceDirection farmer 1 true/warp farmer 95 49/playSound doorClose/animate MorrisTod false true 120 0 1 2/showFrame MorrisTod 4/stopAnimation MorrisTod/advancedMove MorrisTod false 0 3 2 0/positionOffset MorrisTod 1 -1 true/shake MorrisTod 1200/jump MorrisTod 8/eventSeen Author.TestPack.Event1 false/addItem (O)388 2 0/removeItem (O)388 1/addObject 64 15 (O)388/removeObject 64 15/removeSprite 64 15/changeLocation Town/changeMapTile Buildings 64 15 123/changePortrait MorrisTod Happy/changeSprite MorrisTod Winter/friendship MorrisTod 250/money -100/end dialogue MorrisTod "{{i18n:Author.TestPack.Event1.branch.end}}"',
            )
            self.assertNotIn("StardewCPStudio", json.dumps(change))

    def test_export_story_event_supports_single_argument_fork(self):
        import json

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            project.manifest.Name = "Test Pack"
            project.manifest.Author = "Author"
            project.manifest.UniqueID = "Author.TestPack"
            project.game_data.append(GameDataEntry(
                kind="event",
                name="Single Fork Story Event",
                target="Data/Events/Farm",
                key="746153081/IsHost",
                value='continue/-500 -500/farmer 95 49 2/question fork0 "{{i18n:Author.TestPack.Event.Question}}"/fork 746153081_PurchasedAuroraVineyard',
                advanced={
                    "StardewCPStudio": {
                        "storyEvent": {
                            "nodes": [
                                {"kind": "question", "data": {"forkId": "fork0", "i18nKey": "Author.TestPack.Event.Question"}},
                                {"kind": "fork", "data": {"requirement": "", "eventId": "746153081_PurchasedAuroraVineyard"}},
                            ],
                            "branches": [
                                {
                                    "key": "746153081_PurchasedAuroraVineyard",
                                    "nodes": [
                                        {"kind": "message", "data": {"i18nKey": "Author.TestPack.Event.Purchased"}},
                                    ],
                                }
                            ]
                        }
                    }
                },
            ))

            output = export_content_pack(project, temp_dir)
            change = next(change for change in json.loads((output / "code" / "events.json").read_text(encoding="utf-8"))["Changes"] if change.get("Target") == "Data/Events/Farm")

            self.assertIn('fork 746153081_PurchasedAuroraVineyard', change["Entries"]["746153081/IsHost"])
            self.assertNotIn('fork fork0 746153081_PurchasedAuroraVineyard', change["Entries"]["746153081/IsHost"])
            self.assertEqual(
                change["Entries"]["746153081_PurchasedAuroraVineyard"],
                'message "{{i18n:Author.TestPack.Event.Purchased}}"',
            )

    def test_import_asset_can_use_character_asset_path(self):
        import asyncio

        with TemporaryDirectory() as temp_dir:
            project = new_project()
            with Path(__file__).open("rb") as upload_file:
                upload = SimpleNamespace(
                    filename="Sophia.png",
                    content_type="image/png",
                    file=upload_file,
                )
                project, asset, temp_path = asyncio.run(import_asset(
                    project,
                    upload,
                    Path(temp_dir),
                    "assets/CharacterFiles/Portraits/Sophia/Sophia.png",
                ))

            self.assertTrue(temp_path.exists())
            self.assertEqual(asset.stored_path, "assets/CharacterFiles/Portraits/Sophia/Sophia.png")
            self.assertEqual(project.assets[0].stored_path, asset.stored_path)

    def test_ai_config_does_not_expose_key(self):
        with TemporaryDirectory() as temp_dir:
            runtime = Path(temp_dir)
            saved = save_ai_config(runtime, SaveAIConfigRequest(provider="deepseek", model="deepseek-chat", api_key="secret-key"))
            loaded = get_ai_config(runtime)

            self.assertTrue(saved.api_key_set)
            self.assertTrue(loaded.api_key_set)
            self.assertEqual(loaded.api_key_suffix, "-key")
            self.assertFalse(hasattr(loaded, "api_key"))

    def test_ai_suggest_requires_key(self):
        with TemporaryDirectory() as temp_dir:
            with self.assertRaises(ValueError) as context:
                suggest_with_ai(Path(temp_dir), AISuggestRequest(kind="when", prompt="春天第一天生效"))

            self.assertIn("API Key", str(context.exception))

    def test_ruleset_field_schemas_are_loaded(self):
        ruleset = load_ruleset()

        self.assertIn("seasons", ruleset.field_schemas)
        self.assertIn("when_conditions", ruleset.field_schemas)

    def test_rule_library_and_ai_context_are_loaded(self):
        library = load_rule_library()
        context = ai_rule_context()

        self.assertIn("content_patcher", library)
        self.assertIn("game_data", library)
        self.assertTrue(context["content_patcher"]["patch_actions"])
        self.assertTrue(context["game_data"]["targets"])
        self.assertIn("text_operations", context["content_patcher"])
        self.assertIn("common_field_types", context["game_data"])
        self.assertTrue(context["reference_patterns"])
        self.assertTrue(any(reference["id"] == "sve-cp-structure" for reference in context["reference_patterns"]))
        self.assertTrue(any(target["target"] == "Data/NPCGiftTastes" for target in context["game_data"]["targets"]))
        self.assertTrue(any(target["target"] == "Data/TriggerActions" for target in context["game_data"]["targets"]))
        dialogue = next(target for target in context["game_data"]["targets"] if target["kind"] == "dialogue")
        event = next(target for target in context["game_data"]["targets"] if target["kind"] == "event")
        schedule = next(target for target in context["game_data"]["targets"] if target["kind"] == "schedule")
        gift_taste = next(target for target in context["game_data"]["targets"] if target["kind"] == "gift_taste")
        mail = next(target for target in context["game_data"]["targets"] if target["kind"] == "mail")
        trigger_action = next(target for target in context["game_data"]["targets"] if target["kind"] == "trigger_action")
        npc = next(target for target in context["game_data"]["targets"] if target["kind"] == "npc")
        item = next(target for target in context["game_data"]["targets"] if target["kind"] == "item")
        location = next(target for target in context["game_data"]["targets"] if target["kind"] == "location")

        self.assertTrue(dialogue["commands"])
        self.assertTrue(dialogue["dialogue_key_builder"])
        self.assertTrue(event["event_commands"])
        self.assertTrue(schedule["schedule_points"])
        self.assertTrue(gift_taste["taste_groups"])
        self.assertTrue(any(target["target"] == "Data/MoviesReactions" for target in context["game_data"]["targets"]))
        self.assertTrue(gift_taste["text_operation_templates"])
        self.assertTrue(mail["mail_markers"])
        self.assertTrue(mail["attachment_types"])
        self.assertTrue(trigger_action["action_examples"])
        self.assertTrue(trigger_action["trigger_examples"])
        self.assertTrue(npc["field_groups"])
        self.assertTrue(npc["related_assets"])
        self.assertTrue(item["item_data_targets"])
        self.assertTrue(location["substructures"])

    def test_item_catalog_loads_objects_json(self):
        import json

        with TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "Objects.json"
            path.write_text(json.dumps({
                "388": {
                    "Name": "Wood",
                    "DisplayName": "[LocalizedText Strings\\Objects:Wood_Name]",
                    "Type": "Basic",
                    "Category": -16,
                }
            }), encoding="utf-8")
            previous_paths = item_catalog.KNOWN_OBJECT_PATHS
            previous_catalog = item_catalog.CATALOG_PATH
            item_catalog.load_item_catalog.cache_clear()
            try:
                item_catalog.KNOWN_OBJECT_PATHS = [path]
                item_catalog.CATALOG_PATH = Path(temp_dir) / "missing-catalog.json"
                catalog = item_catalog.load_item_catalog()
            finally:
                item_catalog.KNOWN_OBJECT_PATHS = previous_paths
                item_catalog.CATALOG_PATH = previous_catalog
                item_catalog.load_item_catalog.cache_clear()

            self.assertEqual(catalog.items[0].id, "388")
            self.assertEqual(catalog.items[0].qualified_id, "(O)388")
            self.assertEqual(catalog.items[0].category, -16)

    def test_builtin_item_catalog_has_chinese_names_and_full_object_coverage(self):
        item_catalog.load_item_catalog.cache_clear()
        catalog = item_catalog.load_item_catalog()

        self.assertGreaterEqual(len(catalog.items), 807)
        gold_bar = next(item for item in catalog.items if item.id == "336")
        self.assertEqual(gold_bar.qualified_id, "(O)336")
        self.assertTrue(gold_bar.display_name)
        self.assertNotIn("LocalizedText", gold_bar.display_name)

    def test_object_categories_include_wiki_values(self):
        ruleset = load_ruleset()
        categories = {item["value"]: item for item in ruleset.field_schemas["object_categories"]}

        for value in [-9, -17, -23, -102, -103, -999]:
            self.assertIn(value, categories)
        self.assertEqual(categories[-2]["context_tag"], "category_gem")
        self.assertEqual(categories[-999]["internal_constant"], "Object.litterCategory")


if __name__ == "__main__":
    unittest.main()
