from dotenv import load_dotenv

from app.constraints.generator import ConstraintGenerator


load_dotenv()


def main():
    generator = ConstraintGenerator()

    constraint = generator.generate(
        "Rahul should teach at most 3 periods on Monday."
    )

    print("\n===== GENERATED CONSTRAINT =====")
    print(constraint)


if __name__ == "__main__":
    main()